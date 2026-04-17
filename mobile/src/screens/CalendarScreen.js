import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { colors, spacing } from '../theme';
import {
  getTodayBs, getBsMonthDays, getBsDayOfWeek, bsToAd, toNepaliNumeral,
  BS_MONTHS, BS_MONTHS_NP, WEEKDAYS_SHORT_NP,
} from '../bs-date';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 32) / 7);

export default function CalendarScreen() {
  const todayBs = getTodayBs();
  const [year, setYear] = useState(todayBs.year);
  const [month, setMonth] = useState(todayBs.month);
  const [holidays, setHolidays] = useState([]);
  const [designEvents, setDesignEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewMode, setViewMode] = useState('monthly');

  const loadHolidays = async () => {
    try {
      const [hData, dData] = await Promise.all([
        api.getHolidays(year),
        api.getDesignEvents(year).catch(() => ({ events: [] })),
      ]);
      setHolidays(hData.holidays || []);
      setDesignEvents(dData.events || []);
    } catch (err) {
      console.error('Failed to load holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadHolidays();
    }, [year])
  );

  // Build holiday lookup for current month
  const holidayMap = {};
  holidays.forEach(h => {
    if (h.bs_month === month) {
      const startDay = h.bs_day;
      const endDay = (h.bs_month_end === month || !h.bs_month_end) ? (h.bs_day_end || h.bs_day) : getBsMonthDays(year, month);
      for (let d = startDay; d <= endDay; d++) {
        holidayMap[d] = h;
      }
    }
    // Handle holidays that span from previous month into current
    if (h.bs_month_end === month && h.bs_month !== month) {
      for (let d = 1; d <= (h.bs_day_end || 1); d++) {
        holidayMap[d] = h;
      }
    }
  });

  const daysInMonth = getBsMonthDays(year, month);
  const startDow = getBsDayOfWeek(year, month, 1);

  // Build calendar grid
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) => d === todayBs.day && month === todayBs.month && year === todayBs.year;
  const isSaturday = (d) => {
    if (!d) return false;
    const idx = cells.indexOf(d);
    return idx % 7 === 6;
  };

  const prevMonth = () => {
    setSelectedDay(null);
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    setSelectedDay(null);
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const goToToday = () => {
    setSelectedDay(null);
    setYear(todayBs.year);
    setMonth(todayBs.month);
  };

  // Get AD date for display
  const firstAd = bsToAd(year, month, 1);
  const lastAd = bsToAd(year, month, daysInMonth);
  const adRange = `${firstAd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}${
    firstAd.getMonth() !== lastAd.getMonth() ? ' – ' + lastAd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''
  }`;

  // Selected day info
  const selectedHoliday = selectedDay ? holidayMap[selectedDay] : null;
  const selectedAdDate = selectedDay ? bsToAd(year, month, selectedDay) : null;

  // Build design event lookup by AD date
  const designEventMap = {};
  designEvents.forEach(e => {
    if (e.event_date) {
      if (!designEventMap[e.event_date]) designEventMap[e.event_date] = [];
      designEventMap[e.event_date].push(e);
    }
  });

  // Get design events for a given BS day
  const getDesignEventsForDay = (d) => {
    if (!d) return [];
    const adDate = bsToAd(year, month, d);
    const adStr = adDate.toISOString().split('T')[0];
    return designEventMap[adStr] || [];
  };

  const selectedDesignEvents = selectedDay ? getDesignEventsForDay(selectedDay) : [];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'monthly' && styles.tabActive]}
          onPress={() => setViewMode('monthly')}
        >
          <Ionicons name="calendar-outline" size={16} color={viewMode === 'monthly' ? '#fff' : colors.textSecondary} />
          <Text style={[styles.tabText, viewMode === 'monthly' && styles.tabTextActive]}>Monthly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'notice' && styles.tabActive]}
          onPress={() => setViewMode('notice')}
        >
          <Ionicons name="document-text-outline" size={16} color={viewMode === 'notice' ? '#fff' : colors.textSecondary} />
          <Text style={[styles.tabText, viewMode === 'notice' && styles.tabTextActive]}>Holiday Notice</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'notice' ? (
        /* Holiday Notice View */
        <View style={styles.noticeContainer}>
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeCompany}>ARCHISYS INNOVATIONS</Text>
            <Text style={styles.noticeSubtitle}>Attendance Management System</Text>
          </View>
          <Text style={styles.noticeTitle}>OFFICIAL NOTICE</Text>
          <Text style={styles.noticeSubject}>
            <Text style={{ fontWeight: '700' }}>Subject: </Text>
            Public Holiday Schedule for Fiscal Year {year} B.S.
          </Text>
          <Text style={styles.noticeBody}>
            This is to inform all employees that the following public holidays have been approved for the fiscal year {year} B.S. The schedule reflects major national, cultural, and religious observances while ensuring continuity of business operations.
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { width: 36 }]}>S.N.</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Holiday</Text>
                <Text style={[styles.tableHeaderText, { width: 90 }]}>BS Date</Text>
                <Text style={[styles.tableHeaderText, { width: 90 }]}>AD Date</Text>
              </View>

              {/* Table Rows */}
              {holidays.map((h, i) => {
                const bsDate = h.bs_day_end
                  ? `${h.bs_month}/${h.bs_day}-${h.bs_day_end}`
                  : `${h.bs_month}/${h.bs_day}`;
                const adDate = h.ad_date_end
                  ? `${h.ad_date.slice(5)} – ${h.ad_date_end.slice(5)}`
                  : h.ad_date ? h.ad_date.slice(5) : '—';
                return (
                  <View key={h.id} style={[styles.tableRow, i % 2 === 0 && styles.tableRowEven]}>
                    <Text style={[styles.tableCell, { width: 36, textAlign: 'center' }]}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tableCell, { fontWeight: '600' }]}>{h.name}</Text>
                      {h.women_only ? <Text style={styles.womenTag}>Women Only</Text> : null}
                    </View>
                    <Text style={[styles.tableCell, { width: 90, textAlign: 'center' }]}>{bsDate}</Text>
                    <Text style={[styles.tableCell, { width: 90, textAlign: 'center' }]}>{adDate}</Text>
                  </View>
                );
              })}

              {/* Notes */}
              <View style={styles.noticeNotes}>
                <Text style={styles.noticeNotesTitle}>Notes:</Text>
                <Text style={styles.noticeNote}>• Saturdays shall remain weekly holidays.</Text>
                <Text style={styles.noticeNote}>• Holidays falling on weekends shall not be substituted unless otherwise notified.</Text>
                <Text style={styles.noticeNote}>• Festival dates are subject to change as per official lunar calendar confirmations.</Text>
                <Text style={styles.noticeNote}>• The management reserves the right to make necessary amendments if required.</Text>
              </View>

              {/* Signature */}
              <View style={styles.noticeSignature}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>Authorized Signatory</Text>
                <Text style={styles.signatureDept}>Human Resources Department</Text>
              </View>
            </>
          )}
        </View>
      ) : (
      <>
      {/* Month navigation */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} style={styles.monthInfo}>
          <Text style={styles.monthNp}>{BS_MONTHS_NP[month - 1]}</Text>
          <Text style={styles.monthEn}>{BS_MONTHS[month - 1]} {year}</Text>
          <Text style={styles.adRange}>{adRange}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Weekday headers */}
          <View style={styles.weekRow}>
            {WEEKDAYS_SHORT_NP.map((d, i) => (
              <View key={i} style={styles.weekCell}>
                <Text style={[styles.weekText, i === 6 && styles.satText]}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {cells.map((day, idx) => {
              if (day === null) {
                return <View key={`e-${idx}`} style={styles.cell} />;
              }
              const holiday = holidayMap[day];
              const today = isToday(day);
              const sat = isSaturday(day);
              const isSelected = selectedDay === day;
              const dayDesignEvents = getDesignEventsForDay(day);

              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.cell,
                    today && styles.todayCell,
                    isSelected && styles.selectedCell,
                  ]}
                  onPress={() => setSelectedDay(day === selectedDay ? null : day)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dayNp,
                    today && styles.todayText,
                    sat && styles.satText,
                    holiday && styles.holidayText,
                    isSelected && styles.selectedText,
                  ]}>
                    {toNepaliNumeral(day)}
                  </Text>
                  <Text style={[
                    styles.dayEn,
                    today && styles.todayTextSm,
                    sat && { color: '#ef4444' },
                    holiday && { color: '#ef4444' },
                    isSelected && styles.selectedTextSm,
                  ]}>
                    {day}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 2, justifyContent: 'center' }}>
                    {holiday && (
                      <View style={[styles.dot, holiday.women_only ? styles.dotPurple : styles.dotRed]} />
                    )}
                    {dayDesignEvents.length > 0 && (
                      <View style={[styles.dot, { backgroundColor: '#7c3aed' }]} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected day info */}
          {selectedDay && (
            <View style={styles.infoCard}>
              <Text style={styles.infoDate}>
                {toNepaliNumeral(year)}/{toNepaliNumeral(String(month).padStart(2, '0'))}/{toNepaliNumeral(String(selectedDay).padStart(2, '0'))}
              </Text>
              <Text style={styles.infoAdDate}>
                {selectedAdDate?.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
              {selectedHoliday ? (
                <View style={[styles.holidayBadge, selectedHoliday.women_only && styles.holidayBadgePurple]}>
                  <Ionicons name="flag" size={14} color="#fff" />
                  <Text style={styles.holidayBadgeText}>
                    {selectedHoliday.name}{selectedHoliday.name_np ? ` (${selectedHoliday.name_np})` : ''}
                  </Text>
                </View>
              ) : selectedDesignEvents.length === 0 ? (
                <Text style={styles.infoNormal}>Regular working day</Text>
              ) : null}
              {selectedDesignEvents.length > 0 && selectedDesignEvents.map(dt => (
                <View key={dt.id} style={{ backgroundColor: '#f5f3ff', borderRadius: 8, padding: 10, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 18 }}>🎨</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#6d28d9' }}>{dt.event_name}</Text>
                    <Text style={{ fontSize: 11, color: '#7c3aed', textTransform: 'capitalize' }}>{dt.category} • {dt.status || 'pending'}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Holidays this month */}
          {holidays.filter(h => h.bs_month === month).length > 0 && (
            <View style={styles.holidayList}>
              <Text style={styles.holidayListTitle}>Holidays this month</Text>
              {holidays.filter(h => h.bs_month === month).map(h => (
                <View key={h.id} style={styles.holidayItem}>
                  <View style={[styles.holidayDot, h.women_only && { backgroundColor: '#7c3aed' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.holidayName}>{h.name}</Text>
                    {h.name_np ? <Text style={styles.holidayNameNp}>{h.name_np}</Text> : null}
                    <Text style={styles.holidayDate}>
                      {BS_MONTHS_NP[month - 1]} {toNepaliNumeral(h.bs_day)}
                      {h.bs_day_end ? ` - ${toNepaliNumeral(h.bs_day_end)}` : ''}
                      {h.ad_date ? `  •  ${h.ad_date}` : ''}
                    </Text>
                  </View>
                  {h.women_only ? (
                    <View style={styles.womenBadge}>
                      <Text style={styles.womenBadgeText}>Women</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* Design events this month */}
          {(() => {
            const monthFirstAd = bsToAd(year, month, 1).toISOString().split('T')[0];
            const monthLastAd = bsToAd(year, month, daysInMonth).toISOString().split('T')[0];
            const monthDesignEvents = designEvents.filter(e => e.event_date >= monthFirstAd && e.event_date <= monthLastAd);
            if (monthDesignEvents.length === 0) return null;
            return (
              <View style={[styles.holidayList, { borderLeftColor: '#7c3aed' }]}>
                <Text style={[styles.holidayListTitle, { color: '#6d28d9' }]}>🎨 Design Events this month</Text>
                {monthDesignEvents.map(dt => (
                  <View key={dt.id} style={styles.holidayItem}>
                    <View style={[styles.holidayDot, { backgroundColor: '#7c3aed' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.holidayName}>{dt.event_name}</Text>
                      <Text style={styles.holidayDate}>{dt.event_date} • {dt.category}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })()}

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>Today</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendText}>Holiday</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#7c3aed' }]} />
              <Text style={styles.legendText}>Women Only</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={[styles.legendText, { color: '#ef4444', fontWeight: '600' }]}>शनि</Text>
              <Text style={styles.legendText}>Saturday</Text>
            </View>
          </View>
        </>
      )}
      </>
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthInfo: {
    alignItems: 'center',
    flex: 1,
  },
  monthNp: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  monthEn: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  adRange: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: 6,
  },
  weekText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  satText: {
    color: '#ef4444',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  todayCell: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  selectedCell: {
    backgroundColor: colors.primary,
  },
  dayNp: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  dayEn: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: -1,
  },
  todayText: {
    color: colors.primary,
    fontWeight: '800',
  },
  todayTextSm: {
    color: colors.primary,
  },
  selectedText: {
    color: '#fff',
    fontWeight: '800',
  },
  selectedTextSm: {
    color: 'rgba(255,255,255,0.8)',
  },
  holidayText: {
    color: '#ef4444',
    fontWeight: '700',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 4,
  },
  dotRed: {
    backgroundColor: '#ef4444',
  },
  dotPurple: {
    backgroundColor: '#7c3aed',
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoDate: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  infoAdDate: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoNormal: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 8,
  },
  holidayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  holidayBadgePurple: {
    backgroundColor: '#7c3aed',
  },
  holidayBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  holidayList: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  holidayListTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  holidayItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  holidayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginTop: 5,
  },
  holidayName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  holidayNameNp: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  holidayDate: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  womenBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  womenBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7c3aed',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  // Tab switcher
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 4,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  // Holiday Notice
  noticeContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeHeader: {
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
  },
  noticeCompany: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
  },
  noticeSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  noticeSubject: {
    fontSize: 13,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  noticeBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableHeaderText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 12,
    color: colors.text,
  },
  womenTag: {
    fontSize: 9,
    color: '#7c3aed',
    fontWeight: '600',
    marginTop: 1,
  },
  noticeNotes: {
    marginTop: spacing.lg,
  },
  noticeNotesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  noticeNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 3,
    lineHeight: 17,
  },
  noticeSignature: {
    alignItems: 'flex-end',
    marginTop: spacing.xxl,
  },
  signatureLine: {
    width: 160,
    borderTopWidth: 1,
    borderTopColor: colors.textTertiary,
    marginBottom: 6,
  },
  signatureName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  signatureDept: {
    fontSize: 11,
    color: colors.textTertiary,
  },
});
