import { Link } from 'react-router-dom';
import { VENUES } from '../../data/venues.js';
import { listVenueLayouts } from '../../data/hallLayouts.js';
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
            <th scope="col">Конфигурации зала</th>
          </tr>
        </thead>
        <tbody>
          {VENUES.map((venue) => (
            <tr key={venue.id}>
              <td className={styles.name}>{venue.name}</td>
              <td>{venue.address}</td>
              <td>
                <ul className={styles.links}>
                  {listVenueLayouts(venue.id).data.map((layout) => (
                    <li key={layout.id}>
                      <Link to={`/admin/layouts/${layout.id}`} className={styles.link}>
                        {layout.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
