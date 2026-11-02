import { useMemo } from 'react';
import { listEvents, listEventSessions } from '../../data/events.js';
import { pluralizeSessions } from '../../lib/format.js';
import styles from './AdminPage.module.css';

export default function AdminEventsPage() {
  const events = useMemo(() => listEvents({ per_page: 500 }).data, []);

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.heading}>События</h1>
        <span className={styles.count}>{events.length}</span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Название</th>
            <th scope="col">Категория</th>
            <th scope="col">Сеансы</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const sessions = listEventSessions(event.id).length;
            return (
              <tr key={event.id}>
                <td className={styles.name}>{event.title}</td>
                <td>{event.category.name}</td>
                <td className={styles.mono}>{pluralizeSessions(sessions)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
