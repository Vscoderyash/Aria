import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Chat from "@/pages/chat";
import Workspace from "@/pages/workspace";
import Owner from "@/pages/owner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsVariant: "iconButton" as const,
  },
  variables: {
    colorPrimary: "#D4AF37",
    colorForeground: "#F5F0E8",
    colorMutedForeground: "#9CA3AF",
    colorDanger: "#EF4444",
    colorBackground: "#0D0D0D",
    colorInput: "#1A1A1A",
    colorInputForeground: "#F5F0E8",
    colorNeutral: "#2A2A2A",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#111111] border border-[#D4AF37]/20 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl shadow-[#D4AF37]/5",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#F5F0E8] font-semibold",
    headerSubtitle: "text-[#9CA3AF]",
    socialButtonsBlockButtonText: "text-[#F5F0E8]",
    formFieldLabel: "text-[#D4D4D4]",
    footerActionLink: "text-[#D4AF37] hover:text-[#F5D760]",
    footerActionText: "text-[#9CA3AF]",
    dividerText: "text-[#6B7280]",
    identityPreviewEditButton: "text-[#D4AF37]",
    formFieldSuccessText: "text-green-400",
    alertText: "text-[#F5F0E8]",
    logoBox: "mb-2",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border-[#2A2A2A] bg-[#1A1A1A] hover:bg-[#222222]",
    formButtonPrimary: "bg-[#D4AF37] hover:bg-[#F5D760] text-black font-semibold",
    formFieldInput: "bg-[#1A1A1A] border-[#2A2A2A] text-[#F5F0E8]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#2A2A2A]",
    alert: "bg-[#1A1A1A] border-[#2A2A2A]",
    otpCodeFieldInput: "bg-[#1A1A1A] border-[#2A2A2A] text-[#F5F0E8]",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: "radial-gradient(ellipse at center, #1a1500 0%, #0a0a0a 70%)" }}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: "radial-gradient(ellipse at center, #1a1500 0%, #0a0a0a 70%)" }}>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsubscribe = addListener(({ user }: any) => {
      const userId = (user?.id ?? null) as string | null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/chat">
        <Show when="signed-in"><Chat /></Show>
        <Show when="signed-out"><Redirect to="/sign-in" /></Show>
      </Route>
      <Route path="/chat/:id">
        <Show when="signed-in"><Chat /></Show>
        <Show when="signed-out"><Redirect to="/sign-in" /></Show>
      </Route>
      <Route path="/workspace">
        <Show when="signed-in"><Workspace /></Show>
        <Show when="signed-out"><Redirect to="/sign-in" /></Show>
      </Route>
      <Route path="/owner">
        <Show when="signed-in"><Owner /></Show>
        <Show when="signed-out"><Redirect to="/sign-in" /></Show>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back to ARIA",
            subtitle: "Sign in to your AI engineering workspace",
          },
        },
        signUp: {
          start: {
            title: "Join ARIA GOLD",
            subtitle: "Create your autonomous AI engineering account",
          },
        },
      }}
      routerPush={(to: string) => setLocation(stripBase(to))}
      routerReplace={(to: string) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
