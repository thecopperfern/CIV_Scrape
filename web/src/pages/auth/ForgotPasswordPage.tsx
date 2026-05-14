import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { requestPasswordReset } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await requestPasswordReset(email);
      setDone(true);
      if ((res as any).devLink) setDevLink((res as any).devLink);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <Card className="panel w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>We&apos;ll send you a link if an account matches.</CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4">
              <p className="text-sm">
                If an account exists for <span className="font-medium">{email}</span>, a reset link has been
                generated. Email delivery isn&apos;t enabled in this preview — check your server log for
                the token or contact your admin.
              </p>
              {devLink && (
                <div className="text-xs break-all panel p-3">
                  Dev link: <a href={devLink} className="underline">{devLink}</a>
                </div>
              )}
              <Link href="/login">
                <a className="text-sm underline">Back to sign in</a>
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset link"}
              </Button>
              <Link href="/login">
                <a className="block text-center text-sm text-muted-foreground">Back to sign in</a>
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
