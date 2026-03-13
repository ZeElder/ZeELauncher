import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerWithEmail } from "../services/auth";
import { createProfileIfMissing } from "../services/profileRemote";

export default function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async () => {
    try {
      setLoading(true);
      setMessage(null);
      setSuccess(false);

      if (!email.trim()) {
        throw new Error("Adresse mail requise.");
      }

      if (password.length < 6) {
        throw new Error("Le mot de passe doit faire au moins 6 caractères.");
      }

      if (password !== confirmPassword) {
        throw new Error("Les mots de passe ne correspondent pas.");
      }

      const { data, error } = await registerWithEmail(email.trim(), password);

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Compte créé mais utilisateur introuvable.");
      }

      if (!data.session) {
        setSuccess(true);
        setMessage(
          "Compte créé. Vérifie ton email pour confirmer ton inscription, puis connecte-toi."
        );
        return;
      }

      await createProfileIfMissing({
        id: data.user.id,
        email: data.user.email,
      });

      navigate("/");
    } catch (error) {
      console.error("REGISTER ERROR:", error);

      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Erreur inconnue pendant l'inscription.");
      }

      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090d12] px-6 text-white">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#11161d] p-8 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
          Compte
        </p>

        <h1 className="mt-2 text-3xl font-bold text-white">
          Créer un compte
        </h1>

        <p className="mt-2 text-sm text-white/60">
          Rejoins ZeELauncher avec ton adresse mail.
        </p>

        <div className="mt-6 space-y-4">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Adresse mail"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/30"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/30"
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmer le mot de passe"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/30"
          />

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Création..." : "Créer mon compte"}
          </button>

          {message && (
            <p className={`text-sm ${success ? "text-green-300" : "text-red-300"}`}>
              {message}
            </p>
          )}

          <p className="text-sm text-white/60">
            Déjà un compte ?{" "}
            <Link to="/login" className="text-blue-300 hover:text-blue-200">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}