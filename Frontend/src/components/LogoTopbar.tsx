import logo from '../assets/logo2.png';
import { irParaInicio } from '../utils/inicio';
import './LogoTopbar.css';

type Props = {
  /** Ação ao clicar. Se omitida, navega para o início (irParaInicio). */
  onClick?: () => void;
  className?: string;
  title?: string;
};

export default function LogoTopbar({ onClick, className = '', title = 'Voltar ao início' }: Props) {
  return (
    <a
      href="/"
      className={`logo-topbar ${className}`.trim()}
      title={title}
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick();
        else irParaInicio();
      }}
    >
      <img src={logo} alt="Mercadins" />
    </a>
  );
}
