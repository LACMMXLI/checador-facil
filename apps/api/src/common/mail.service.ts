import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private log = new Logger('Mail');
  private transport = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;
  /** Último mensaje por destinatario; sólo se conserva en memoria cuando NO hay SMTP (desarrollo/pruebas). */
  static outbox = new Map<string, { subject: string; text: string; link?: string }>();

  async send(to: string, subject: string, text: string, link?: string) {
    if (!this.transport) {
      MailService.outbox.set(to.toLowerCase(), { subject, text, link });
      if (process.env.NODE_ENV !== 'test') this.log.warn(`[SIN SMTP] Para: ${to} | ${subject} | ${link ?? text}`);
      return;
    }
    try {
      await this.transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
    } catch (e) {
      this.log.error(`No se pudo enviar correo a ${to}: ${(e as Error).message}`);
    }
  }
}
