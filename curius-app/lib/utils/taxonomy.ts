// Curius Link Taxonomy - 6 Topics, 31 Subtopics
// Matches the scraper's classification output exactly

export const TAXONOMY = {
  'Technology': {
    description: 'Computing, software, AI, digital infrastructure',
    color: 'hsl(200, 80%, 50%)',
    subtopics: [
      'AI & Machine Learning',
      'Developer Tools',
      'Software Engineering',
      'DevOps & Infrastructure',
      'Security',
      'Hardware',
    ],
  },
  'Culture': {
    description: 'Humanities, arts, philosophy, society',
    color: 'hsl(330, 65%, 50%)',
    subtopics: [
      'Art & Design',
      'Philosophy & Ideas',
      'Politics & Society',
      'History',
      'Books & Literature',
    ],
  },
  'Science': {
    description: 'Natural world, research, medicine',
    color: 'hsl(150, 60%, 40%)',
    subtopics: [
      'Biology & Biotech',
      'Physics & Math',
      'Medicine & Health',
      'Research Papers',
      'Climate & Environment',
    ],
  },
  'Business': {
    description: 'Commerce, startups, finance, economics',
    color: 'hsl(35, 80%, 50%)',
    subtopics: [
      'Startups & Founders',
      'Investing & Finance',
      'Management & Leadership',
      'Marketing & Growth',
      'Economics',
    ],
  },
  'Personal': {
    description: 'Self-improvement, career, learning, health',
    color: 'hsl(270, 50%, 55%)',
    subtopics: [
      'Life Advice',
      'Career & Skills',
      'Learning & Education',
      'Productivity',
      'Health & Fitness',
    ],
  },
  'Media': {
    description: 'Entertainment, podcasts, news, gaming',
    color: 'hsl(0, 65%, 55%)',
    subtopics: [
      'Entertainment',
      'Podcasts & Videos',
      'News & Modern Events',
      'Gaming',
      'Sports',
    ],
  },
} as const;

export type MainCategory = keyof typeof TAXONOMY;
export type SubCategory<T extends MainCategory> = typeof TAXONOMY[T]['subtopics'][number];

export function getAllCategories(): MainCategory[] {
  return Object.keys(TAXONOMY) as MainCategory[];
}

export function getCategoryInfo(category: MainCategory) {
  return TAXONOMY[category];
}

export function getSubtopics(mainCategory: MainCategory): readonly string[] {
  return TAXONOMY[mainCategory]?.subtopics || [];
}

export function getCategoryColor(category: string): string {
  return (TAXONOMY as Record<string, { color: string }>)[category]?.color || 'hsl(0, 0%, 50%)';
}

export function getTotalSubtopics(): number {
  return Object.values(TAXONOMY).reduce(
    (sum, cat) => sum + cat.subtopics.length,
    0
  );
}

export function getFlatTaxonomy(): Array<{ topic: MainCategory; subtopic: string }> {
  const flat: Array<{ topic: MainCategory; subtopic: string }> = [];
  for (const [topic, data] of Object.entries(TAXONOMY)) {
    for (const subtopic of data.subtopics) {
      flat.push({ topic: topic as MainCategory, subtopic });
    }
  }
  return flat;
}

export function isValidCategory(topic: string, subtopic?: string): boolean {
  if (!(topic in TAXONOMY)) return false;
  if (!subtopic) return true;
  return TAXONOMY[topic as MainCategory].subtopics.includes(subtopic as never);
}
