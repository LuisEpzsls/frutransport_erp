import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="border-b border-slate-700 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-green-600 text-white font-bold text-sm px-3 py-1.5 rounded-lg">FT</div>
          <span className="text-white font-semibold">Frutransport</span>
          <span className="text-slate-500 text-sm hidden sm:inline">· ERP Corporativo</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#servicios" className="text-slate-400 hover:text-white text-sm transition">
            Módulos
          </a>
          <Link
            to="/login"
            className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            Ingresar
          </Link>
        </div>
      </div>
    </nav>
  );
}
