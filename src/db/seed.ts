import mongoose from 'mongoose';
import '../config/env.js';
import { DATA_VERSION, syncCatalogue } from './catalogue.js';
import { connectDatabase, disconnectDatabase } from './connect.js';
import { ArticleModel } from '../models/article.model.js';
import { DoctorModel } from '../models/doctor.model.js';
import { FacilityModel } from '../models/facility.model.js';
import { LabTestModel } from '../models/lab-test.model.js';
import { LabModel } from '../models/lab.model.js';
import { MedicineModel } from '../models/medicine.model.js';
import { MetaModel } from '../models/meta.model.js';
import { ReviewModel } from '../models/review.model.js';
import { SpecialtyModel } from '../models/specialty.model.js';

/** `npm run seed`: force a full catalogue sync (the server also does this by itself when DATA_VERSION changes). */
async function seed() {
  await connectDatabase();
  console.log('seeding…');
  await syncCatalogue(process.env.SEED_VERBOSE ? console.log : undefined);
  await MetaModel.updateOne({ _id: 'catalogue' }, { $set: { version: DATA_VERSION, running: false, syncedAt: new Date(), error: '' } }, { upsert: true });

  const count = async (label: string, n: Promise<number>) => console.log(`${label.padEnd(14)}${await n}`);
  await count('specialties', SpecialtyModel.countDocuments());
  await count('facilities', FacilityModel.countDocuments());
  await count('doctors', DoctorModel.countDocuments());
  await count('reviews', ReviewModel.countDocuments());
  await count('medicines', MedicineModel.countDocuments());
  await count('lab tests', LabTestModel.countDocuments());
  await count('labs', LabModel.countDocuments());
  await count('articles', ArticleModel.countDocuments());

  await mongoose.connection.close();
  await disconnectDatabase();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
