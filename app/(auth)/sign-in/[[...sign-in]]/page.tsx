import { SignInForm } from './SignInForm';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-connexion-black">
      <img src="/connexion-logo.png" alt="Connexion" className="h-12 w-auto mb-6" />
      <SignInForm />
    </div>
  );
}
