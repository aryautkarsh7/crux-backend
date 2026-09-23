import { Schema, model } from 'mongoose';

/** Bookkeeping for the catalogue sync that runs on deploy. */
const metaSchema = new Schema(
  {
    _id: { type: String, required: true },
    version: { type: String, default: '' },
    running: { type: Boolean, default: false },
    startedAt: { type: Date },
    syncedAt: { type: Date },
    error: { type: String, default: '' },
  },
  { versionKey: false },
);

export const MetaModel = model('Meta', metaSchema);
