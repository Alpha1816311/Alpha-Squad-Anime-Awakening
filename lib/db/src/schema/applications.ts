import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const applicationStatusEnum = pgEnum("application_status", [
  "NEW",
  "UNDER REVIEW",
  "INTERVIEW",
  "PRACTICAL TASK",
  "SHORTLISTED",
  "SELECTED",
  "WAITLISTED",
  "DECLINED",
  "WITHDRAWN",
]);

export type TeamworkAnswers = {
  prototypePriority: string;
  unfamiliarTechnology: string;
  blockedTeammate: string;
  failingFeature: string;
  architectureDisagreement: string;
  communicateDelays?: string;
  handleFeedback?: string;
  expectFromTeammates?: string;
  offerToTeammates?: string;
};

export const applicationsTable = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: varchar("reference", { length: 40 }).notNull().unique(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    cityState: varchar("city_state", { length: 120 }).notNull(),
    institution: varchar("institution", { length: 180 }).notNull(),
    background: varchar("background", { length: 160 }).notNull(),
    academicStatus: varchar("academic_status", { length: 80 }).notNull(),
    primaryRole: varchar("primary_role", { length: 100 }).notNull(),
    secondarySkills: text("secondary_skills").array().notNull().default([]),
    skillLevel: varchar("skill_level", { length: 60 }).notNull(),
    toolsUsed: text("tools_used").array().notNull().default([]),
    projectExperience: text("project_experience").notNull().default(""),
    contribution: text("contribution").notNull().default(""),
    learningGoals: text("learning_goals").notNull(),
    hoursPerWeek: integer("hours_per_week").notNull(),
    motivation: text("motivation").notNull(),
    teamwork: jsonb("teamwork").$type<TeamworkAnswers>().notNull(),
    favoriteAnime: varchar("favorite_anime", { length: 100 }),
    favoriteCharacter: varchar("favorite_character", { length: 100 }),
    fictionalClass: varchar("fictional_class", { length: 100 }),
    phone: varchar("phone", { length: 40 }),
    githubUrl: varchar("github_url", { length: 300 }),
    linkedinUrl: varchar("linkedin_url", { length: 300 }),
    portfolioUrl: varchar("portfolio_url", { length: 500 }),
    consentedAt: timestamp("consented_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: applicationStatusEnum("status").notNull().default("NEW"),
    founderNotes: text("founder_notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    createdAtIndex: index("applications_created_at_idx").on(table.createdAt),
    statusIndex: index("applications_status_idx").on(table.status),
    roleIndex: index("applications_primary_role_idx").on(table.primaryRole),
    emailIndex: index("applications_email_idx").on(table.email),
  }),
);

export type ApplicationRecord = typeof applicationsTable.$inferSelect;
export type NewApplicationRecord = typeof applicationsTable.$inferInsert;
