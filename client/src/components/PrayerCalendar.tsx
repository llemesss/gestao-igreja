import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface PrayerCalendarProps {
  userId: string;
  year: number;
}

const PrayerCalendar: React.FC<PrayerCalendarProps> = ({ userId, year }) => {
  const [prayedDates, setPrayedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Nomes dos meses abreviados
  const monthNames = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  
  // Dias por mês (considerando ano bissexto)
  const getDaysInMonth = (month: number, year: number): number => {
    return new Date(year, month, 0).getDate();
  };

  const isLeapYear = (year: number): boolean => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  };

  useEffect(() => {
    const fetchPrayerData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/users/${userId}/prayer-calendar?year=${year}`);
        setPrayedDates(response.data);
        setError(null);
      } catch (err) {
        console.error('Erro ao buscar dados de oração:', err);
        setError('Erro ao carregar calendário de oração');
        setPrayedDates([]);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchPrayerData();
    }
  }, [userId, year]);

  // Função para verificar se uma data específica tem oração registrada
  const hasPrayer = (month: number, day: number): boolean => {
    const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return prayedDates.includes(dateString);
  };

  // Função para verificar se um dia é válido para o mês
  const isValidDay = (month: number, day: number): boolean => {
    const daysInMonth = getDaysInMonth(month, year);
    return day <= daysInMonth;
  };

  if (loading) {
    return (
      <div className="prayer-calendar-loading">
        <p>Carregando calendário de oração...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="prayer-calendar-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="prayer-calendar">
      <table className="prayer-calendar-table">
        <thead>
          <tr>
            <th className="month-header"></th>
            {Array.from({ length: 31 }, (_, i) => (
              <th key={i + 1} className="day-header">
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthNames.map((monthName, monthIndex) => {
            const month = monthIndex + 1;
            return (
              <tr key={month}>
                <td className="month-label">{monthName}</td>
                {Array.from({ length: 31 }, (_, dayIndex) => {
                  const day = dayIndex + 1;
                  const isValid = isValidDay(month, day);
                  const hasPrayerDay = isValid && hasPrayer(month, day);
                  
                  let cellClass = 'calendar-cell';
                  if (!isValid) {
                    cellClass += ' invalid-day';
                  } else if (hasPrayerDay) {
                    cellClass += ' prayer-day';
                  } else {
                    cellClass += ' empty-day';
                  }

                  return (
                    <td key={day} className={cellClass}>
                      {isValid ? (hasPrayerDay ? '●' : '') : ''}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <style jsx>{`
        .prayer-calendar {
          margin: 20px 0;
          font-family: Arial, sans-serif;
        }

        .prayer-calendar-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
          table-layout: fixed;
        }

        .month-header,
        .day-header {
          background-color: #f5f5f5;
          border: 1px solid #ddd;
          padding: 2px;
          text-align: center;
          font-weight: bold;
          font-size: 8px;
        }

        .month-header {
          width: 20px;
        }

        .day-header {
          width: 15px;
        }

        .month-label {
          background-color: #f0f0f0;
          border: 1px solid #ddd;
          padding: 2px;
          text-align: center;
          font-weight: bold;
          font-size: 9px;
          width: 20px;
        }

        .calendar-cell {
          border: 1px solid #ddd;
          padding: 1px;
          text-align: center;
          width: 15px;
          height: 15px;
          font-size: 8px;
        }

        .invalid-day {
          background-color: #333;
        }

        .prayer-day {
          background-color: #4CAF50;
          color: white;
          font-weight: bold;
        }

        .empty-day {
          background-color: white;
        }

        .prayer-calendar-loading,
        .prayer-calendar-error {
          padding: 20px;
          text-align: center;
          font-size: 14px;
        }

        .prayer-calendar-error {
          color: #d32f2f;
        }

        /* Estilos específicos para impressão */
        @media print {
          .prayer-calendar-table {
            font-size: 8px;
            page-break-inside: avoid;
          }

          .month-header,
          .day-header {
            font-size: 6px;
            padding: 1px;
          }

          .month-label {
            font-size: 7px;
            padding: 1px;
          }

          .calendar-cell {
            font-size: 6px;
            padding: 0.5px;
            height: 12px;
          }

          .prayer-calendar-loading,
          .prayer-calendar-error {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default PrayerCalendar;