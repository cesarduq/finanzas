import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import { Profile } from '../types/database';

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar sesión inicial
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Modo local/demo temporal mientras el usuario ingresa sus credenciales en .env
      const localUser = localStorage.getItem('finanzas_local_user');
      if (localUser) {
        try {
          const parsed = JSON.parse(localUser);
          setUser(parsed);
          setProfile({
            id: parsed.id,
            email: parsed.email,
            full_name: parsed.full_name || 'César Duque',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } catch {}
      }
      setLoading(false);
      return;
    }

    // Obtener sesión activa de Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Escuchar cambios de autenticación en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data);
      }
    } catch (err) {
      console.warn('Error al cargar perfil:', err);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      // Login en modo local
      const mockUser = {
        id: 'local-user-id',
        email,
        full_name: 'Usuario Local',
      };
      localStorage.setItem('finanzas_local_user', JSON.stringify(mockUser));
      setUser(mockUser);
      setProfile({
        id: mockUser.id,
        email: mockUser.email,
        full_name: mockUser.full_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!isSupabaseConfigured || !supabase) {
      const mockUser = {
        id: 'local-user-id',
        email,
        full_name: fullName,
      };
      localStorage.setItem('finanzas_local_user', JSON.stringify(mockUser));
      setUser(mockUser);
      setProfile({
        id: mockUser.id,
        email: mockUser.email,
        full_name: mockUser.full_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { error: null };
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  };

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('finanzas_local_user');
    }
    setUser(null);
    setProfile(null);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user?.email) {
      return { error: 'No hay sesión activa.' };
    }

    if (!isSupabaseConfigured || !supabase) {
      return { error: null };
    }

    try {
      // 1. Validar que la contraseña actual sea correcta
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyErr) {
        return { error: 'La contraseña actual no es correcta.' };
      }

      // 2. Actualizar a la nueva contraseña
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        return { error: updateErr.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Error al cambiar la contraseña.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
