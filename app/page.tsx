import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.home}>
      <div className={styles.mark}>GONG</div>

      <div className={styles.middle}>
        <h1 className={styles.title}>
          Pronti,
          <br />
          via.
        </h1>
        <p className={styles.subtitle}>
          Tabata, serie a ripetizioni, circuito. Tocca lo schermo per chiudere una
          serie, tieni premuto in qualunque punto per la pausa.
        </p>
      </div>

      <Link href="/player" className={styles.cta}>
        Avvia sessione
      </Link>
    </div>
  );
}
