export default function ServiceCard({ titulo, descripcion, icono, color }) {
  return (
    <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-6 hover:border-green-500/50 hover:bg-slate-700 transition cursor-default">
      <div className="text-4xl mb-4">{icono}</div>
      <h3 className="text-white font-semibold text-lg mb-2">{titulo}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{descripcion}</p>
    </div>
  );
}
