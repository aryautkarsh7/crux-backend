/**
 * Tells the Curxx team about an appointment request. Never the doctor or the hospital: every message goes
 * to the test recipients (TEST_NOTIFY_EMAIL / TEST_NOTIFY_PHONE) or only to the log.
 * - NOTIFY_MODE=log, or no test recipient set: written to the log.
 * - test (default) and live: sent to the test recipients only. Contacting real doctors needs their private
 *   contacts and consent, which this flow doesn't have yet.
 */
import { env } from '../../config/env.js';
import { AppointmentRequestModel } from '../../models/appointment-request.model.js';
import { notifyLog, providers } from './providers.js';

type Request = {
  _id: unknown;
  reference: string;
  doctorName: string;
  facilityName: string;
  patient: { name: string; phone: string };
  preferredDay: string;
  preferredTime: string;
};

export function requestSummary(r: Request) {
  const when = [
    r.preferredDay || 'any day',
    r.preferredTime === 'any' ? 'any time' : r.preferredTime,
  ]
    .filter(Boolean)
    .join(', ');
  return `Appointment request ${r.reference}: ${r.patient.name} (${r.patient.phone}) for ${r.doctorName}${r.facilityName ? ` at ${r.facilityName}` : ''}, ${when}.`;
}

export async function notifyAppointmentRequest(r: Request) {
  const text = `${requestSummary(r)} Call the patient to confirm. (Curxx test notice: not sent to the doctor or hospital.)`;
  const email = env.TEST_NOTIFY_EMAIL;
  const phone = env.TEST_NOTIFY_PHONE;
  let status = 'logged';
  let detail = '';
  try {
    if (env.NOTIFY_MODE === 'log' || (!email && !phone)) {
      notifyLog(text);
      detail =
        env.NOTIFY_MODE === 'log' ? 'NOTIFY_MODE=log' : 'no TEST_NOTIFY_EMAIL / TEST_NOTIFY_PHONE';
    } else {
      const { email: emailProvider, sms } = providers();
      const sent: string[] = [];
      if (email && emailProvider) {
        await emailProvider.send({ to: email, subject: `Curxx: ${r.reference}`, text });
        sent.push('email');
      }
      if (phone) {
        const result = await sms.send({
          to: phone,
          template: 'booking_request_test',
          vars: [r.reference, r.doctorName, r.patient.name],
          text,
        });
        sent.push(result.logged ? 'sms (log only)' : 'sms');
      }
      status = sent.length ? 'test' : 'logged';
      detail = sent.length ? `test recipients: ${sent.join(', ')}` : 'no email provider';
      if (!sent.length) notifyLog(text);
    }
  } catch (error) {
    status = 'failed';
    detail = String((error as Error)?.message ?? error).slice(0, 200);
  }
  await AppointmentRequestModel.updateOne(
    { _id: r._id },
    { $set: { notify: { status, mode: env.NOTIFY_MODE, detail, at: new Date() } } },
  );
  return status;
}
