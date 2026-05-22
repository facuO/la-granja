import { query } from "../db.js";
import { nextStubBlock, totalStubBlocks, stubSessionSummary } from "./stub-tutor.js";
import type { StubBlock } from "./stub-tutor.js";

export interface StartSessionInput {
  topicId: string;
}

export interface StartSessionResult {
  sessionId: string;
  stepsPlanned: number;
}

export async function startSession(input: StartSessionInput): Promise<StartSessionResult> {
  const { rows: topicRows } = await query<{ id: string; subject_id: string; status: string }>(
    `SELECT t.id, b.subject_id, t.status
       FROM topics t JOIN blocks b ON b.id = t.block_id
      WHERE t.id = $1`,
    [input.topicId]
  );
  if (topicRows.length === 0) throw new Error("topic_not_found");
  const topic = topicRows[0];
  if (!["featured", "available", "done", "mastered"].includes(topic.status)) {
    throw new Error("topic_not_eligible");
  }

  const stepsPlanned = totalStubBlocks(topic.id);

  const { rows: sessionRows } = await query<{ id: string }>(
    `INSERT INTO sessions (subject_id, topic_id, steps_planned)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [topic.subject_id, topic.id, stepsPlanned]
  );
  return { sessionId: sessionRows[0].id, stepsPlanned };
}

export interface NextBlockResult {
  done: boolean;
  block?: StubBlock;
  stepIndex?: number;
}

export async function nextBlock(sessionId: string): Promise<NextBlockResult> {
  const { rows } = await query<{ steps_completed: number; status: string; topic_id: string }>(
    `SELECT steps_completed, status, topic_id FROM sessions WHERE id = $1`,
    [sessionId]
  );
  if (rows.length === 0) throw new Error("session_not_found");
  if (rows[0].status !== "active") return { done: true };

  const stepIndex = rows[0].steps_completed;
  const block = nextStubBlock(rows[0].topic_id, stepIndex);

  if (!block) return { done: true };

  await query(
    `INSERT INTO messages (session_id, step_index, block_kind, role, content)
     VALUES ($1, $2, $3, 'tutor', $4)`,
    [sessionId, stepIndex, block.block_kind, JSON.stringify(block.content)]
  );
  await query(
    `UPDATE sessions SET steps_completed = steps_completed + 1 WHERE id = $1`,
    [sessionId]
  );

  return { done: false, block, stepIndex };
}

export interface FinishSessionResult {
  summary: string;
}

export async function finishSession(sessionId: string): Promise<FinishSessionResult> {
  const { rows } = await query<{ topic_id: string }>(
    `SELECT topic_id FROM sessions WHERE id = $1`,
    [sessionId]
  );
  await query(
    `UPDATE sessions
        SET status = 'finished', ended_at = now()
      WHERE id = $1 AND status = 'active'`,
    [sessionId]
  );
  const topicId = rows[0]?.topic_id ?? "";
  return { summary: stubSessionSummary(topicId) };
}
