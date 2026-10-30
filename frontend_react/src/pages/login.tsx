import {
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  LogInIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  WorkflowIcon,
  ZapIcon,
} from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Logo, LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
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

  const points = [
    { icon: WorkflowIcon, title: t("login.point1"), description: t("login.point1Desc") },
    { icon: ZapIcon, title: t("login.point2"), description: t("login.point2Desc") },
    { icon: ShieldCheckIcon, title: t("login.point3"), description: t("login.point3Desc") },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid min-h-svh lg:grid-cols-[1.08fr_1fr]">
        {/* Brand panel — intentionally dark in both themes. */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[oklch(0.165_0.022_268)] p-10 text-white lg:flex xl:p-14">
          <div className="bg-grid-light pointer-events-none absolute inset-0 opacity-70" />
          <div className="pointer-events-none absolute -top-32 -right-24 size-[420px] rounded-full bg-primary/30 blur-[130px]" />
          <div className="pointer-events-none absolute bottom-[-180px] left-[-120px] size-[380px] rounded-full bg-[oklch(0.7_0.16_190)]/20 blur-[130px]" />

          <div className="relative">
            <Logo className="text-white [&_span]:text-white/90" />
          </div>

          <div className="relative flex max-w-lg flex-col gap-8">
            <div className="flex flex-col gap-4">
              <h2 className="text-3xl font-semibold tracking-tight text-white text-balance xl:text-4xl">
                {t("login.brandTitle")}
              </h2>
              <p className="text-sm leading-relaxed text-white/60">
                {t("login.brandSubtitle")}
              </p>
            </div>

            <ul className="flex flex-col gap-4">
              {points.map((point) => (
                <li key={point.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/8 ring-1 ring-white/10">
                    <point.icon className="size-4 text-white/80" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-white/90">
                      {point.title}
                    </span>
                    <span className="text-xs leading-relaxed text-white/45">
                      {point.description}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex items-center justify-between text-[11px] text-white/35">
            <span>© {new Date().getFullYear()} H UI</span>
            <span className="font-mono tracking-wide">Hysteria2</span>
          </div>
        </aside>

        {/* Form panel */}
        <main className="relative flex flex-col">
          <header className="flex items-center justify-between p-4 md:p-6">
            <div className="lg:hidden">
              <Logo />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          </header>

          <div className="flex flex-1 items-center justify-center px-4 pb-20 md:px-10 xl:px-14">
            <div className="w-full max-w-md">
              <div className="mb-8 flex flex-col gap-2">
                <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 lg:hidden">
                  <LogoMark className="size-7" />
                </div>
                <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  {t("app.tagline")}
                </p>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {t("login.title")}
                </h1>
              </div>

              <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
                <Field data-invalid={Boolean(errors.username)}>
                  <FieldLabel htmlFor="username">{t("login.username")}</FieldLabel>
                  <InputGroup className="h-10">
                    <InputGroupAddon>
                      <UserRoundIcon className="text-muted-foreground" />
                    </InputGroupAddon>
                    <InputGroupInput
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
                    />
                  </InputGroup>
                  {errors.username && <FieldError>{errors.username}</FieldError>}
                </Field>

                <Field data-invalid={Boolean(errors.pass)}>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="password">{t("login.password")}</FieldLabel>
                    {capsLock && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <TriangleAlertIcon className="size-3" />
                        {t("login.capsLock")}
                      </span>
                    )}
                  </div>
                  <InputGroup className="h-10">
                    <InputGroupAddon>
                      <KeyRoundIcon className="text-muted-foreground" />
                    </InputGroupAddon>
                    <InputGroupInput
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
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        onClick={() => setPasswordVisible((prev) => !prev)}
                        aria-label={
                          passwordVisible ? t("common.close") : t("common.select")
                        }
                      >
                        {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {errors.pass && <FieldError>{errors.pass}</FieldError>}
                </Field>

                <Button
                  type="submit"
                  size="lg"
                  className="mt-1 h-10 w-full"
                  disabled={loading}
                >
                  {loading ? <Spinner /> : <LogInIcon data-icon="inline-start" />}
                  {loading ? t("login.signingIn") : t("login.login")}
                </Button>
              </form>

              <p className="mt-8 text-center text-xs text-muted-foreground">
                {t("login.footer")}
              </p>
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
