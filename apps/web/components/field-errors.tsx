export function FieldError({ errors, name }: { errors: Record<string, string>; name: string }) {
  const message = errors[name];
  if (!message) return null;
  return (
    <p className="mt-1 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}
