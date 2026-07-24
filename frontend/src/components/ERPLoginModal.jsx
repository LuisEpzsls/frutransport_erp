import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../context/I18nContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { STRINGS } from "../i18n/strings.js";
import { IconLock, IconArrow, IconX } from "./icons/index.jsx";

/** Mismo mapeo de rol → home que Login.jsx (roles del enum de Prisma). */
const HOME_BY_ROLE = {
  ADMIN:   "/admin/dashboard",
  MANAGER: "/admin/dashboard",
  AUDITOR: "/auditor/historial",
  CLIENTE: "/cliente/cotizaciones",
};

const COUNTRIES = [
  "Perú","Chile","Argentina","Brasil","México","Colombia",
  "United States","Canada","United Kingdom","Spain","France",
  "Germany","Netherlands","Italy","China","Hong Kong","Japan",
  "South Korea","Singapore","Other",
];

export default function ERPLoginModal({ open, onClose }) {
  const { lang } = useI18n();
  const A = STRINGS[lang].account;
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode]           = useState("signin");
  const [form, setForm]           = useState({
    email: "", pwd: "",
    fullName: "", company: "", country: "", phone: "", terms: false,
  });
  const [errors, setErrors]       = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember]   = useState(true);
  const firstFieldRef             = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => firstFieldRef.current?.focus(), 220);
    } else {
      setTimeout(() => {
        setSubmitting(false); setErrors({});
        setForm({ email: "", pwd: "", fullName: "", company: "", country: "", phone: "", terms: false });
        setMode("signin");
      }, 300);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && open) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function setF(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  }

  function validate() {
    const errs = {};
    if (mode === "signin") {
      if (!form.email.trim()) errs.email = A.errors.required;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = A.errors.email;
      if (!form.pwd) errs.pwd = A.errors.required;
    } else {
      if (!form.fullName.trim()) errs.fullName = A.errors.required;
      if (!form.company.trim())  errs.company  = A.errors.required;
      if (!form.country.trim())  errs.country  = A.errors.required;
      if (!form.email.trim())    errs.email    = A.errors.required;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = A.errors.email;
      if (!form.pwd)             errs.pwd      = A.errors.required;
      else if (form.pwd.length < 8) errs.pwd   = A.errors.short;
      if (!form.terms)           errs.terms    = A.errors.required;
    }
    return errs;
  }

  async function submit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    // Registro: aún no existe backend de clientes — se informa, no se simula.
    if (mode === "signup") {
      setErrors({ form: A.registerUnavailable });
      return;
    }

    // Login REAL contra /api/auth/login (misma sesión que /login)
    setSubmitting(true);
    try {
      const usuario = await login(form.email, form.pwd);
      onClose();
      navigate(HOME_BY_ROLE[usuario?.role] ?? "/", { replace: true });
    } catch (err) {
      setErrors({ form: err.response?.data?.error || "Error al iniciar sesión" });
      setSubmitting(false);
    }
  }

  const isSignup = mode === "signup";

  const body = (
    <>
      <div className="modal-eyebrow">{A.eyebrow[mode]}</div>
      <h3 className="modal-title">{A.title[mode]}</h3>

      <div className="account-tabs" role="tablist">
        <button role="tab" type="button" aria-selected={!isSignup}
          className={"account-tab" + (!isSignup ? " active" : "")}
          onClick={() => { setMode("signin"); setErrors({}); }}>
          {A.tabs.signin}
        </button>
        <button role="tab" type="button" aria-selected={isSignup}
          className={"account-tab" + (isSignup ? " active" : "")}
          onClick={() => { setMode("signup"); setErrors({}); }}>
          {A.tabs.signup}
        </button>
      </div>

      <form onSubmit={submit} noValidate>
        {errors.form && (
          <div className="field err" style={{
            border: "1px solid var(--warn, #dc2626)", borderRadius: 8,
            padding: "10px 14px", marginBottom: 14,
          }}>
            <span className="errmsg mono" style={{ display: "block" }}>{errors.form}</span>
          </div>
        )}
        {isSignup && (
          <>
            <div className={"field" + (errors.fullName ? " err" : "")}>
              <label htmlFor="acc-name">{A.fields.fullName}</label>
              <input ref={firstFieldRef} id="acc-name" type="text"
                placeholder={A.fields.fullNamePh} value={form.fullName}
                onChange={(e) => setF("fullName", e.target.value)}
                autoComplete="name" />
              {errors.fullName && <span className="errmsg mono">{errors.fullName}</span>}
            </div>
            <div className="field-row">
              <div className={"field" + (errors.company ? " err" : "")}>
                <label htmlFor="acc-company">{A.fields.company}</label>
                <input id="acc-company" type="text"
                  placeholder={A.fields.companyPh} value={form.company}
                  onChange={(e) => setF("company", e.target.value)}
                  autoComplete="organization" />
                {errors.company && <span className="errmsg mono">{errors.company}</span>}
              </div>
              <div className={"field" + (errors.country ? " err" : "")}>
                <label htmlFor="acc-country">{A.fields.country}</label>
                <select id="acc-country" value={form.country}
                  onChange={(e) => setF("country", e.target.value)}
                  style={{
                    fontFamily: "var(--sans)", fontSize: 14,
                    color: form.country ? "var(--ink)" : "var(--ink-3)",
                    background: "var(--bg)", border: "1px solid var(--line-2)",
                    borderRadius: 8, padding: "12px 14px", width: "100%",
                  }}>
                  <option value="">{A.fields.countryPh}</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.country && <span className="errmsg mono">{errors.country}</span>}
              </div>
            </div>
          </>
        )}

        <div className={"field" + (errors.email ? " err" : "")}>
          <label htmlFor="acc-email">{A.fields.email}</label>
          <input ref={!isSignup ? firstFieldRef : null} id="acc-email" type="email"
            placeholder={A.fields.emailPh} value={form.email}
            onChange={(e) => setF("email", e.target.value)}
            autoComplete="email" />
          {errors.email && <span className="errmsg mono">{errors.email}</span>}
        </div>

        <div className={"field" + (errors.pwd ? " err" : "")}>
          <label htmlFor="acc-pwd">{A.fields.password}</label>
          <input id="acc-pwd" type="password"
            placeholder={isSignup ? A.fields.passwordPh : "••••••••"}
            value={form.pwd}
            onChange={(e) => setF("pwd", e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"} />
          {errors.pwd && <span className="errmsg mono">{errors.pwd}</span>}
        </div>

        {isSignup ? (
          <>
            <div className="field">
              <label htmlFor="acc-phone">{A.fields.phone}</label>
              <input id="acc-phone" type="tel"
                placeholder={A.fields.phonePh} value={form.phone}
                onChange={(e) => setF("phone", e.target.value)}
                autoComplete="tel" />
            </div>
            <div className="row-inline" style={{ alignItems: "flex-start" }}>
              <label className={"checkbox" + (errors.terms ? " err" : "")}
                style={errors.terms ? { color: "var(--warn)" } : {}}>
                <input type="checkbox" checked={form.terms}
                  onChange={() => setF("terms", !form.terms)} />
                <span style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                  {A.terms_a}
                  <strong style={{ color: "var(--ink)" }}>{A.terms_b}</strong>
                  {A.terms_c}
                  <strong style={{ color: "var(--ink)" }}>{A.terms_d}</strong>
                  {A.terms_e}
                </span>
              </label>
            </div>
          </>
        ) : (
          <div className="row-inline">
            <label className="checkbox">
              <input type="checkbox" checked={remember}
                onChange={() => setRemember(r => !r)} />
              {A.remember}
            </label>
          </div>
        )}

        <button type="submit"
          className={"modal-submit" + (submitting ? " loading" : "")}
          disabled={submitting}>
          {submitting
            ? (<><span className="spinner" />{" "}{isSignup ? A.creating : A.authenticating}</>)
            : (<>{isSignup ? A.signupCta : A.signinCta}{" "}<IconArrow size={11} /></>)}
        </button>

        <div className="staff-toggle">
          <span>
            {isSignup ? A.hasAccount : A.noAccount}{" "}
            <button type="button" className="staff-link"
              style={{ display: "inline", padding: 0, color: "var(--accent-2)" }}
              onClick={() => { setMode(isSignup ? "signin" : "signup"); setErrors({}); }}>
              {isSignup ? A.switchToSignin : A.switchToSignup} →
            </button>
          </span>
        </div>

        {/* Acceso del personal → página de login del ERP */}
        <div className="staff-toggle" style={{ marginTop: 6 }}>
          <span>
            {A.staffPrompt}{" "}
            <Link to="/login" className="staff-link"
              style={{ display: "inline", padding: 0, color: "var(--accent-2)" }}
              onClick={onClose}>
              {A.staffCta} →
            </Link>
          </span>
        </div>
      </form>
    </>
  );

  return (
    <div
      className={"scrim" + (open ? " open" : "")}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-hidden={!open}
    >
      <div className="modal" data-screen-label="Account Modal">
        <aside className="modal-aside">
          <div>
            <div className="lock-big"><IconLock size={18} /></div>
            <h3>{A.asideTitle}</h3>
            <p>{A.asideBody}</p>
          </div>
          <div className="role-rows">
            {A.perks.map((p, i) => (
              <div key={i} className="row">
                <span>{p.k}</span>
                <span className="scope">{p.v}</span>
              </div>
            ))}
          </div>
        </aside>
        <div className="modal-main">
          <button className="modal-close" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
          {body}
        </div>
      </div>
    </div>
  );
}
