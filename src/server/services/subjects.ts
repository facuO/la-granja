import { query } from "../db.js";

export interface TopicForSelector {
  id: string;
  title: string;
  status: "featured" | "available" | "done" | "mastered";
}

export interface SubjectForSelector {
  id: string;
  name: string;
  topics: TopicForSelector[];
}

export async function getSubjectsForSofi(opts: { difficultMode: boolean }): Promise<SubjectForSelector[]> {
  const statusFilter = opts.difficultMode
    ? `('done', 'mastered')`
    : `('featured', 'available', 'done', 'mastered')`;

  const { rows } = await query<{
    subject_id: string;
    subject_name: string;
    topic_id: string;
    topic_title: string;
    topic_status: TopicForSelector["status"];
  }>(`
    SELECT s.id AS subject_id, s.name AS subject_name,
           t.id AS topic_id, t.title AS topic_title, t.status AS topic_status
      FROM subjects s
      JOIN blocks b ON b.subject_id = s.id
      JOIN topics t ON t.block_id = b.id
     WHERE s.active = true
       AND t.status IN ${statusFilter}
     ORDER BY s.name,
              CASE t.status
                WHEN 'featured' THEN 0
                WHEN 'available' THEN 1
                WHEN 'done' THEN 2
                WHEN 'mastered' THEN 3
              END,
              b.order_index, t.order_index
  `);

  const map = new Map<string, SubjectForSelector>();
  for (const r of rows) {
    if (!map.has(r.subject_id)) {
      map.set(r.subject_id, { id: r.subject_id, name: r.subject_name, topics: [] });
    }
    map.get(r.subject_id)!.topics.push({
      id: r.topic_id,
      title: r.topic_title,
      status: r.topic_status,
    });
  }
  return Array.from(map.values());
}
