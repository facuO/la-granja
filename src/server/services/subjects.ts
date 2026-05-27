import { query } from "../db.js";

export interface TopicForSelector {
  id: string;
  title: string;
  status: "featured" | "available" | "done" | "mastered";
  section: "contenido" | "ejercicios";
}

// Los topics de ejercicios usan UUIDs que empiezan con 66666666 (ver
// migración seed-ejercicios-siblings). El resto es contenido (teoría).
function sectionForTopic(id: string): "contenido" | "ejercicios" {
  return id.startsWith("66666666") ? "ejercicios" : "contenido";
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
    topic_id: string | null;
    topic_title: string | null;
    topic_status: TopicForSelector["status"] | null;
    topic_status_order: number | null;
    block_order_index: number | null;
    topic_order_index: number | null;
  }>(`
    SELECT s.id AS subject_id, s.name AS subject_name,
           t.id AS topic_id, t.title AS topic_title, t.status AS topic_status,
           CASE t.status
             WHEN 'featured' THEN 0
             WHEN 'available' THEN 1
             WHEN 'done' THEN 2
             WHEN 'mastered' THEN 3
             ELSE 9
           END AS topic_status_order,
           b.order_index AS block_order_index,
           t.order_index AS topic_order_index
      FROM subjects s
      LEFT JOIN blocks b ON b.subject_id = s.id
      LEFT JOIN topics t
        ON t.block_id = b.id
       AND t.status IN ${statusFilter}
     WHERE s.active = true
     ORDER BY s.name, block_order_index, topic_order_index, topic_status_order
  `);

  const map = new Map<string, SubjectForSelector>();
  for (const r of rows) {
    if (!map.has(r.subject_id)) {
      map.set(r.subject_id, { id: r.subject_id, name: r.subject_name, topics: [] });
    }
    if (r.topic_id && r.topic_title && r.topic_status) {
      map.get(r.subject_id)!.topics.push({
        id: r.topic_id,
        title: r.topic_title,
        status: r.topic_status,
        section: sectionForTopic(r.topic_id),
      });
    }
  }
  return Array.from(map.values());
}
