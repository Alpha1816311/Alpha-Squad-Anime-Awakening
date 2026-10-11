import { randomBytes } from "node:crypto";
import {
  and,
  arrayOverlaps,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ApplicationStatus,
  GetFounderApplicationParams,
  GetFounderApplicationResponse,
  GetFounderSummaryResponse,
  GetPublicStatusResponse,
  ListFounderApplicationsQueryParams,
  ListFounderApplicationsResponse,
  RequestApplicationPrivacyActionBody,
  RequestApplicationPrivacyActionResponse,
  SubmitApplicationBody,
  SubmitApplicationResponse,
  UpdateFounderApplicationBody,
  UpdateFounderApplicationParams,
  UpdateFounderApplicationResponse,
} from "@workspace/api-zod";
import { applicationsTable, db } from "@workspace/db";
import requireFounder from "../middlewares/requireFounder";
import { getEmailSetupStatus, sendApplicationEmails } from "../services/sendgrid";

const router: IRouter = Router();

function asApplication(record: typeof applicationsTable.$inferSelect) {
  return {
    id: record.id,
    reference: record.reference,
    fullName: record.fullName,
    email: record.email,
    cityState: record.cityState,
    institution: record.institution,
    background: record.background,
    academicStatus: record.academicStatus,
    primaryRole: record.primaryRole,
    secondarySkills: record.secondarySkills,
    skillLevel: record.skillLevel,
    toolsUsed: record.toolsUsed,
    projectExperience: record.projectExperience,
    contribution: record.contribution,
    learningGoals: record.learningGoals,
    hoursPerWeek: record.hoursPerWeek,
    motivation: record.motivation,
    teamwork: record.teamwork,
    favoriteAnime: record.favoriteAnime ?? undefined,
    favoriteCharacter: record.favoriteCharacter ?? undefined,
    fictionalClass: record.fictionalClass ?? undefined,
    phone: record.phone ?? undefined,
    githubUrl: record.githubUrl ?? undefined,
    linkedinUrl: record.linkedinUrl ?? undefined,
    portfolioUrl: record.portfolioUrl ?? undefined,
    consent: true as const,
    status: record.status,
    founderNotes: record.founderNotes,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

router.post("/applications", async (req, res): Promise<void> => {
  const parsed = SubmitApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please review the application fields and try again." });
    return;
  }

  const application = parsed.data;
  const reference = `ALPHA-${new Date().getFullYear()}-${randomBytes(12).toString("hex").toUpperCase()}`;

  let savedRecord: typeof applicationsTable.$inferSelect;
  try {
    const [inserted] = await db
      .insert(applicationsTable)
      .values({
        reference,
        fullName: application.fullName.trim(),
        email: application.email.trim().toLowerCase(),
        cityState: application.cityState.trim(),
        institution: application.institution.trim(),
        background: application.background.trim(),
        academicStatus: application.academicStatus.trim(),
        primaryRole: application.primaryRole.trim(),
        secondarySkills: application.secondarySkills,
        skillLevel: application.skillLevel,
        toolsUsed: application.toolsUsed,
        projectExperience: application.projectExperience,
        contribution: application.contribution,
        learningGoals: application.learningGoals,
        hoursPerWeek: application.hoursPerWeek,
        motivation: application.motivation,
        teamwork: application.teamwork,
        favoriteAnime: application.favoriteAnime ?? null,
        favoriteCharacter: application.favoriteCharacter ?? null,
        fictionalClass: application.fictionalClass ?? null,
        phone: application.phone ?? null,
        githubUrl: application.githubUrl ?? null,
        linkedinUrl: application.linkedinUrl ?? null,
        portfolioUrl: application.portfolioUrl ?? null,
        consentedAt: new Date(),
      })
      .returning();
    if (!inserted) throw new Error("Application insert returned no record");
    savedRecord = inserted;
  } catch (error) {
    req.log.error(
      { errorType: error instanceof Error ? error.name : typeof error },
      "Unable to persist candidate application",
    );
    res.status(503).json({
      error: "We could not securely save your application right now. Please try again shortly.",
    });
    return;
  }

  // Keep the database record even when the email provider is unavailable.
  const emailDelivery = await sendApplicationEmails(savedRecord);
  if (emailDelivery.notificationStatus === "failed") {
    req.log.warn(
      { providerStatusCode: emailDelivery.applicantStatusCode },
      "Applicant confirmation was not accepted by the email provider",
    );
  }
  if (emailDelivery.founderAlertStatus === "failed") {
    req.log.warn(
      { providerStatusCode: emailDelivery.founderStatusCode },
      "Founder application alert was not accepted by the email provider",
    );
  }

  res.status(201).json(
    SubmitApplicationResponse.parse({
      reference: savedRecord.reference,
      createdAt: savedRecord.createdAt.toISOString(),
      notificationStatus: emailDelivery.notificationStatus,
    }),
  );
});

router.post("/applications/privacy-request", async (req, res): Promise<void> => {
  const parsed = RequestApplicationPrivacyActionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the application reference and email used to apply." });
    return;
  }

  const { reference, email, action } = parsed.data;
  const matchingApplication = and(
    eq(applicationsTable.reference, reference.trim().toUpperCase()),
    eq(applicationsTable.email, email.trim().toLowerCase()),
  );

  try {
    if (action === "WITHDRAW") {
      await db
        .update(applicationsTable)
        .set({ status: "WITHDRAWN", updatedAt: new Date() })
        .where(matchingApplication);
    } else {
      await db.delete(applicationsTable).where(matchingApplication);
    }
  } catch (error) {
    req.log.error(
      { errorType: error instanceof Error ? error.name : typeof error },
      "Unable to process candidate privacy request",
    );
    res.status(503).json({ error: "We could not process the request right now. Please try again shortly." });
    return;
  }

  res.json(
    RequestApplicationPrivacyActionResponse.parse({
      message: "If the reference and email matched an application, the request has been processed. No application details were returned.",
    }),
  );
});

router.get("/public/status", async (req, res): Promise<void> => {
  let storage: "database" | "unavailable" = "database";
  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    req.log.error({ err: error }, "Application storage health check failed");
    storage = "unavailable";
  }

  res.json(
    GetPublicStatusResponse.parse({
      storage,
      ...getEmailSetupStatus(),
      aiAnalysis: false,
    }),
  );
});

router.use("/founder", requireFounder);

router.get("/founder/summary", async (_req, res): Promise<void> => {
  const grouped = await db
    .select({ status: applicationsTable.status, total: count() })
    .from(applicationsTable)
    .groupBy(applicationsTable.status);
  const totals = new Map(grouped.map((row) => [row.status, Number(row.total)]));
  const total = grouped.reduce((sum, row) => sum + Number(row.total), 0);

  res.json(
    GetFounderSummaryResponse.parse({
      total,
      new: totals.get("NEW") ?? 0,
      underReview: totals.get("UNDER REVIEW") ?? 0,
      interviews: totals.get("INTERVIEW") ?? 0,
      practicalTasks: totals.get("PRACTICAL TASK") ?? 0,
      shortlisted: totals.get("SHORTLISTED") ?? 0,
      selected: totals.get("SELECTED") ?? 0,
    }),
  );
});

router.get("/founder/applications", async (req, res): Promise<void> => {
  const parsed = ListFounderApplicationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid application filters." });
    return;
  }

  const filters: SQL[] = [];
  if (parsed.data.status) {
    filters.push(eq(applicationsTable.status, parsed.data.status));
  }
  if (parsed.data.role) {
    filters.push(eq(applicationsTable.primaryRole, parsed.data.role));
  }
  if (parsed.data.skill) {
    filters.push(arrayOverlaps(applicationsTable.secondarySkills, [parsed.data.skill]));
  }
  if (parsed.data.search) {
    const term = `%${parsed.data.search}%`;
    const searchFilter = or(
      ilike(applicationsTable.fullName, term),
      ilike(applicationsTable.email, term),
      ilike(applicationsTable.institution, term),
      ilike(applicationsTable.cityState, term),
    );
    if (searchFilter) filters.push(searchFilter);
  }

  const where = filters.length ? and(...filters) : undefined;
  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(applicationsTable)
      .where(where)
      .orderBy(desc(applicationsTable.createdAt))
      .limit(250),
    db.select({ total: count() }).from(applicationsTable).where(where),
  ]);

  res.json(
    ListFounderApplicationsResponse.parse({
      applications: rows.map(asApplication),
      total: Number(totalRow?.total ?? 0),
    }),
  );
});

router.get("/founder/applications/:id", async (req, res): Promise<void> => {
  const params = GetFounderApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid application reference." });
    return;
  }

  const [record] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, params.data.id))
    .limit(1);

  if (!record) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  res.json(GetFounderApplicationResponse.parse(asApplication(record)));
});

router.patch("/founder/applications/:id", async (req, res): Promise<void> => {
  const params = UpdateFounderApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid application reference." });
    return;
  }

  const parsed = UpdateFounderApplicationBody.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    res.status(400).json({ error: "Provide a valid status or founder note to save." });
    return;
  }

  const update = parsed.data;
  const patch: {
    status?: (typeof ApplicationStatus)[keyof typeof ApplicationStatus];
    founderNotes?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (update.status !== undefined) patch.status = update.status;
  if (update.founderNotes !== undefined) patch.founderNotes = update.founderNotes;

  const [record] = await db
    .update(applicationsTable)
    .set(patch)
    .where(eq(applicationsTable.id, params.data.id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  res.json(UpdateFounderApplicationResponse.parse(asApplication(record)));
});

export default router;
