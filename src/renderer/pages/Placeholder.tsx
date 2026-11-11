export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      <p className="mt-2 text-sm text-neutral-400">{text}</p>
    </div>
  )
}
