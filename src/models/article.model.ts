import { Schema, model, type InferSchemaType } from 'mongoose';

const articleSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    category: { type: String, required: true, index: true },
    readMinutes: { type: Number, default: 5 },
    coverUrl: { type: String, default: '' },
    author: { name: String, slug: String, title: String },
    publishedAt: { type: Date, required: true },
    sections: [{ heading: String, body: String, _id: false }],
    keyTakeaways: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

export type Article = InferSchemaType<typeof articleSchema>;
export const ArticleModel = model('Article', articleSchema);
