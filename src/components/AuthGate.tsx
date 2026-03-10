import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentSession, onAuthStateChange } from "../services/auth";

type Props = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const { data } = await getCurrentSession();

        if (!mounted) return;
        setIsAuthed(!!data.session);
      } catch (error) {
        console.error(error);
        if (mounted) {
          setIsAuthed(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void checkSession();

    const {
      data: { subscription },
    } = onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090d12] text-white">
        Vérification de la session...
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}