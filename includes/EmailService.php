<?php
declare(strict_types=1);

namespace Tronex;

use PHPMailer\PHPMailer\PHPMailer;

final class EmailService
{
    public static function getProformaCcEmails(): array
    {
        $raw = Config::get('INVOICE_CC_EMAILS', 'tronexcarimportersltd@gmail.com,faithmaina393@gmail.com') ?? '';
        $parts = preg_split('/[,;\s]+/', $raw) ?: [];
        return array_values(array_unique(array_filter(array_map('trim', $parts))));
    }

    public static function sendWithPdf(array $to, string $subject, string $text, string $filename, string $pdfBinary): array
    {
        $from = Config::get('EMAIL_FROM');
        if (!$from) {
            throw new \RuntimeException('Set EMAIL_FROM in .env');
        }

        $host = Config::get('SMTP_HOST');
        $port = Config::get('SMTP_PORT');
        $user = Config::get('SMTP_USER');
        $pass = Config::get('SMTP_PASS');

        if (!$host || !$port || !$user || !$pass) {
            throw new \RuntimeException('Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
        }

        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $host;
        $mail->Port = (int) $port;
        $mail->SMTPAuth = true;
        $mail->Username = $user;
        $mail->Password = $pass;
        $secure = strtolower(Config::get('SMTP_SECURE', 'false') ?? 'false') === 'true' || (int) $port === 465;
        $mail->SMTPSecure = $secure ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;

        if (preg_match('/^(.+?)\s*<(.+)>$/', $from, $m)) {
            $mail->setFrom(trim($m[2]), trim($m[1]));
        } else {
            $mail->setFrom($from);
        }

        foreach ($to as $addr) {
            $mail->addAddress($addr);
        }

        $mail->Subject = $subject;
        $mail->Body = $text;
        $mail->addStringAttachment($pdfBinary, $filename, 'base64', 'application/pdf');
        $mail->send();

        return ['provider' => 'smtp', 'id' => $mail->getLastMessageID()];
    }
}
