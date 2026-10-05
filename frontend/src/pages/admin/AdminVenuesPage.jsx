import { VENUES } from '../../data/venues.js';
import styles from './AdminPage.module.css';

export default function AdminVenuesPage() {
  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.heading}>Площадки</h1>
        <span className={styles.count}>{VENUES.length}</span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Название</th>
            <th scope="col">Адрес</th>
          </tr>
        </thead>
        <tbody>
          {VENUES.map((venue) => (
            <tr key={venue.id}>
              <td className={styles.name}>{venue.name}</td>
              <td>{venue.address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
