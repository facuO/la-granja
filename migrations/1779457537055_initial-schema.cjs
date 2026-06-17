exports.up = (pgm) => {
  pgm.createExtension("pgcrypto", { ifNotExists: true });

  pgm.createTable("users", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    email: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    role: { type: "text", notNull: true, check: "role IN ('parent', 'at', 'dai', 'therapist')" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    revoked_at: { type: "timestamptz" },
  });

  pgm.createTable("magic_links", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: '"users"', onDelete: "CASCADE" },
    token: { type: "text", notNull: true, unique: true },
    expires_at: { type: "timestamptz", notNull: true },
    used_at: { type: "timestamptz" },
  });
  pgm.createIndex("magic_links", "token", {
    name: "idx_magic_links_token",
    where: "used_at IS NULL",
  });

  pgm.createTable("sofi_tokens", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    token: { type: "text", notNull: true, unique: true },
    device_name: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    revoked_at: { type: "timestamptz" },
  });
  pgm.createIndex("sofi_tokens", "token", {
    name: "idx_sofi_tokens_token",
    where: "revoked_at IS NULL",
  });

  pgm.createTable("subjects", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    name: { type: "text", notNull: true },
    active: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("blocks", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    subject_id: { type: "uuid", notNull: true, references: '"subjects"', onDelete: "CASCADE" },
    title: { type: "text", notNull: true },
    order_index: { type: "int", notNull: true, default: 0 },
  });

  pgm.createTable("topics", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    block_id: { type: "uuid", notNull: true, references: '"blocks"', onDelete: "CASCADE" },
    title: { type: "text", notNull: true },
    description: { type: "text", notNull: true, default: "" },
    key_concepts: { type: "jsonb", notNull: true, default: pgm.func("'[]'::jsonb") },
    materials: { type: "jsonb", notNull: true, default: pgm.func("'[]'::jsonb") },
    exam_date: { type: "date" },
    status: {
      type: "text",
      notNull: true,
      default: "upcoming",
      check: "status IN ('upcoming', 'available', 'featured', 'done', 'mastered')",
    },
    integration_level_override: {
      type: "int",
      check: "integration_level_override BETWEEN 0 AND 3",
    },
    order_index: { type: "int", notNull: true, default: 0 },
  });
  pgm.createIndex("topics", "block_id", {
    name: "idx_topics_one_featured_per_subject",
    unique: true,
    where: "status = 'featured'",
  });

  pgm.createTable("sessions", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    subject_id: { type: "uuid", notNull: true, references: '"subjects"' },
    topic_id: { type: "uuid", notNull: true, references: '"topics"' },
    started_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    ended_at: { type: "timestamptz" },
    status: {
      type: "text",
      notNull: true,
      default: "active",
      check: "status IN ('active', 'finished', 'abandoned')",
    },
    difficult_mode: { type: "boolean", notNull: true, default: false },
    integration_level: {
      type: "int",
      notNull: true,
      default: 0,
      check: "integration_level BETWEEN 0 AND 3",
    },
    steps_planned: { type: "int", notNull: true, default: 3 },
    steps_completed: { type: "int", notNull: true, default: 0 },
    metadata: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
  });
  pgm.createIndex("sessions", ["status", "started_at"], {
    name: "idx_sessions_status_started",
  });

  pgm.createTable("messages", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    session_id: { type: "uuid", notNull: true, references: '"sessions"', onDelete: "CASCADE" },
    step_index: { type: "int", notNull: true },
    block_kind: {
      type: "text",
      notNull: true,
      check: "block_kind IN ('explanation', 'visual', 'question', 'feedback')",
    },
    role: { type: "text", notNull: true, check: "role IN ('tutor', 'sofi')" },
    content: { type: "jsonb", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    metadata: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
  });
  pgm.createIndex("messages", ["session_id", "step_index", "created_at"], {
    name: "idx_messages_session_step",
  });
};

exports.down = (pgm) => {
  pgm.dropTable("messages");
  pgm.dropTable("sessions");
  pgm.dropTable("topics");
  pgm.dropTable("blocks");
  pgm.dropTable("subjects");
  pgm.dropTable("sofi_tokens");
  pgm.dropTable("magic_links");
  pgm.dropTable("users");
};
