import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendVerificationEmail(toEmail, token) {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from: `"Cloud Vault" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Verify your Cloud Vault Account",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Welcome to Cloud Vault!</h2>
        <p>Please click the button below to verify your email address and activate your account:</p>
        <a href="${verifyUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 15px 0;">Verify Email</a>
        <p style="font-size: 12px; color: #666;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}


export async function sendResetPasswordEmail(toEmail, token) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?resetToken=${token}`;

  const mailOptions = {
    from: `"Cloud Vault" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Reset your Cloud Vault Password",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your Cloud Vault account. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 15px 0;">Reset Password</a>
        <p style="font-size: 13px; color: #666;">Note: This link is valid for <strong>15 minutes</strong> only.</p>
        <p style="font-size: 12px; color: #999;">If you didn't request this, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}