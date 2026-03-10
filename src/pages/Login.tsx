import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginWithEmail } from "../services/auth";
import { createProfileIfMissing } from "../services/profileRemote";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setMessage(null);

      const { data, error } = await loginWithEmail(email, password);

      if (error) throw error;
      if (!data.user) throw new Error("Utilisateur introuvable.");

      await createProfileIfMissing({
        id: data.user.id,
        email: data.user.email,
      });

      navigate("/");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Erreur connexion");
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
        <h1 className="mt-2 text-3xl font-bold text-white">Connexion</h1>
        <p className="mt-2 text-sm text-white/60">
          Connecte-toi à ton compte ZeELauncher.
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

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          {message && <p className="text-sm text-red-300">{message}</p>}

          <p className="text-sm text-white/60">
            Pas encore de compte ?{" "}
            <Link to="/register" className="text-blue-300 hover:text-blue-200">
              S’inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}