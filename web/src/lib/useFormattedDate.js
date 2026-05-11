import { useSettings } from '../context/SettingsContext';
import { formatDate as _formatDate, formatDateTime as _formatDateTime } from './format-date';

export function useFormattedDate() {
  const { dateFormat } = useSettings();
  return {
    formatDate: (date, options) => _formatDate(date, dateFormat, options),
    formatDateTime: (date) => _formatDateTime(date, dateFormat),
    dateFormat,
  };
}
