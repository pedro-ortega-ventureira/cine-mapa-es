export type RegistrationAuthMode = "signin" | "signup";

export function initialRegistrationAuthMode(rawMode: unknown): RegistrationAuthMode {
  return rawMode === "signin" ? "signin" : "signup";
}

export function modeAfterFailedSignIn(errorMessage: string): RegistrationAuthMode {
  return errorMessage.toLowerCase().includes("invalid login credentials") ? "signup" : "signin";
}
