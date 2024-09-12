import {
  type Transporter,
  createTransport,
  SentMessageInfo,
  SendMailOptions,
  createTestAccount,
  TestAccount,
} from "nodemailer";
import * as SMTPTransport from "nodemailer/lib/smtp-transport";

/**
 * A wrapper around nodemailer's Transporter.
 */
export class Mailer {
  private transporter: Transporter<SentMessageInfo>;

  constructor(options: SMTPTransport.Options) {
    this.transporter = createTransport(options);
  }

  /**
   * Creates a test account for testing purposes.
   *
   * @see https://nodemailer.com/smtp/testing/
   */
  public static async createTestAccount(): Promise<TestAccount> {
    return new Promise((resolve, reject) => {
      createTestAccount((err, account) => {
        if (err) {
          reject(err);
        } else {
          resolve(account);
        }
      });
    });
  }

  public async sendMail(options: SendMailOptions): Promise<void> {
    await this.transporter.sendMail(options);
  }
}
