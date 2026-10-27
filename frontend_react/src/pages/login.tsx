import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth";
import { useI18n } from "@/i18n";

const CREDENTIAL_PATTERN = /^[a-zA-Z0-9!@#$%^&*()_+-=]{6,32}$/;

export function LoginPage() {
  const { t } = useI18n();
  const { login, token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const rawRedirect = searchParams.get("redirect") ?? "/";
  const redirect = rawRedirect.startsWith("/") ? rawRedirect : "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; pass?: string }>({});

  if (token && user) {
    return <Navigate to={redirect} replace />;
  }

  const validate = () => {
    const next: { username?: string; pass?: string } = {};

    if (!username) next.username = t("common.required");
    else if (!CREDENTIAL_PATTERN.test(username)) {
      next.username = t("login.usernameRule");
    }

    if (!password) next.pass = t("common.required");
    else if (!CREDENTIAL_PATTERN.test(password)) {
      next.pass = t("login.passwordRule");
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || !validate()) return;

    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate(redirect, { replace: true });
    } catch {
      // The API layer already surfaced the server message as a toast.
    } finally {
      setLoading(false);
    }
  };

  const checkCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    setCapsLock(Boolean(key && key.length === 1 && key >= "A" && key <= "Z"));
  };

  const inputClass =
    "h-11 w-full rounded-none border-0 border-b border-input bg-transparent px-0 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground aria-invalid:border-destructive aria-invalid:focus:border-destructive";

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 opacity-[0.32]"
      />

      <header className="relative z-10 flex h-16 shrink-0 items-center justify-end gap-0.5 px-5 md:px-8">
        <ThemeToggle />
        <LanguageSwitcher />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-24">
        <div className="animate-in fade-in slide-in-from-bottom-2 w-full max-w-[340px] duration-500">
          <div className="rounded-[12px] border border-border bg-card p-7 sm:p-9">
            <h1 className="sr-only">{t("login.title")}</h1>

            <div className="mb-9 flex items-center gap-3">
              <LogoMark className="size-9 rounded-[10px] ring-1 ring-border" />
              <span className="text-sm font-semibold tracking-tight">
                {t("login.title")}
              </span>
            </div>

            <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
              <Field data-invalid={Boolean(errors.username)} className="gap-2">
                <FieldLabel
                  htmlFor="username"
                  className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase"
                >
                  {t("login.username")}
                </FieldLabel>
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  autoFocus
                  placeholder={t("login.usernamePlaceholder")}
                  value={username}
                  aria-invalid={Boolean(errors.username)}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setErrors((prev) => ({ ...prev, username: undefined }));
                  }}
                  className={inputClass}
                />
                {errors.username && (
                  <FieldError className="text-xs">{errors.username}</FieldError>
                )}
              </Field>

              <Field data-invalid={Boolean(errors.pass)} className="gap-2">
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel
                    htmlFor="password"
                    className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase"
                  >
                    {t("login.password")}
                  </FieldLabel>
                  {capsLock && (
                    <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground">
                      {t("login.capsLock")}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="pass"
                    autoComplete="current-password"
                    placeholder={t("login.passwordPlaceholder")}
                    type={passwordVisible ? "text" : "password"}
                    value={password}
                    aria-invalid={Boolean(errors.pass)}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrors((prev) => ({ ...prev, pass: undefined }));
                    }}
                    onKeyUp={checkCapsLock}
                    className={`${inputClass} pr-8`}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((prev) => !prev)}
                    aria-label={
                      passwordVisible
                        ? t("login.hidePassword")
                        : t("login.showPassword")
                    }
                    className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
                  >
                    {passwordVisible ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </div>
                {errors.pass && (
                  <FieldError className="text-xs">{errors.pass}</FieldError>
                )}
              </Field>

              <Button
                type="submit"
                size="lg"
                className="mt-1 h-11 w-full rounded-[6px] text-sm font-medium"
                disabled={loading}
              >
                {loading && <Spinner />}
                {loading ? t("login.signingIn") : t("login.login")}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
