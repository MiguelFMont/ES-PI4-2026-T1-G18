
import nodemailer from "nodemailer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASSWORD
    }
});

export const emailService = {
    async enviarRecuperacaoSenha(email: string, link: string) {
        const pastaTemplates = path.resolve(
            process.cwd(),
            "src/shared/email/templates"
        );

        const html = await readFile(
            path.join(pastaTemplates, "emailRecuperacao.html"),
            "utf-8"
        );

        const css = await readFile(
            path.join(pastaTemplates, "emailRecuperacao.css"),
            "utf-8"
        );

        const htmlComLink = html.replace(
            "{{LINK_REDEFINICAO}}",
            link
        );

        const { default: juice } = await import("juice");

        const htmlFinal = juice.inlineContent(
            htmlComLink,
            css
        );

        await transporter.sendMail({
            from: `"FinanceAI" <${env.EMAIL_USER}>`,
            to: email,
            subject: "Recuperação de senha - FinanceAI",
            html: htmlFinal
        });
    }
};
