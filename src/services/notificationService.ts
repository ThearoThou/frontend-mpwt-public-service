// Mock notification data
const mockNotifications: Array<{
  id: number
  title: string
  message: string
  type: 'success' | 'info' | 'warning' | 'error'
  read: boolean
  archived: boolean
  timestamp: Date
  icon: string
}> = [
  {
    id: 1,
    title: 'New Application Received',
    message: 'Your application for driving license has been received.',
    type: 'success',
    read: false,
    archived: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    icon: 'mdi-file-check',
  },
  {
    id: 2,
    title: 'Appointment Confirmed',
    message: 'Your appointment is confirmed for tomorrow at 10:00 AM.',
    type: 'info',
    read: false,
    archived: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    icon: 'mdi-calendar-check',
  },
  {
    id: 3,
    title: 'Document Expired',
    message: 'Your vehicle registration document will expire in 30 days.',
    type: 'warning',
    read: true,
    archived: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    icon: 'mdi-alert-circle',
  },
  {
    id: 4,
    title: 'Payment Successful',
    message: 'Your payment of $50 has been processed successfully.',
    type: 'success',
    read: true,
    archived: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    icon: 'mdi-check-circle',
  },
  {
    id: 5,
    title: 'Service Maintenance',
    message: 'The system will be under maintenance on Dec 20 from 2-4 PM.',
    type: 'info',
    read: false,
    archived: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
    icon: 'mdi-wrench',
  },
  {
    id: 6,
    title: 'Test Scheduled',
    message: 'Your driving test is scheduled for Dec 25 at 9:00 AM.',
    type: 'info',
    read: true,
    archived: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
    icon: 'mdi-clipboard-check',
  },
  {
    id: 7,
    title: 'Archived Notification',
    message: 'This is an archived notification.',
    type: 'success',
    read: true,
    archived: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    icon: 'mdi-archive',
  },
  {
    id: 8,
    title: 'License Application Approved',
    message: 'Congratulations! Your driving license application has been approved.',
    type: 'success',
    read: false,
    archived: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    icon: 'mdi-badge-check',
  },
  {
    id: 9,
    title: 'Fee Payment Reminder',
    message: 'Your vehicle registration renewal fee is due on January 15, 2026.',
    type: 'warning',
    read: false,
    archived: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
    icon: 'mdi-credit-card-clock',
  },
  {
    id: 10,
    title: 'System Update Complete',
    message: 'The system has been successfully updated to version 2.1.0.',
    type: 'success',
    read: true,
    archived: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    icon: 'mdi-cloud-check',
  },
  {
    id: 11,
    title: 'Violation Notice',
    message: 'A traffic violation has been recorded on your vehicle.',
    type: 'error',
    read: true,
    archived: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
    icon: 'mdi-alert',
  },
  {
    id: 12,
    title: 'Inspection Scheduled',
    message: 'Your vehicle inspection is scheduled for January 10, 2026.',
    type: 'info',
    read: false,
    archived: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
    icon: 'mdi-car-wrench',
  },
]

export interface Notification {
  id: number
  title: string
  message: string
  type: 'success' | 'info' | 'warning' | 'error'
  read: boolean
  archived: boolean
  timestamp: Date
  icon: string
}

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Fetch notifications with pagination
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @param filter - Filter type: 'all', 'unread', 'archived'
 */
export async function fetchNotifications (
  page = 1,
  limit = 5,
  filter: 'all' | 'unread' | 'archived' = 'all',
): Promise<{ data: Notification[], total: number, hasMore: boolean }> {
  await delay(500)

  let filtered = mockNotifications

  if (filter === 'unread') {
    filtered = filtered.filter(n => !n.read && !n.archived)
  } else if (filter === 'archived') {
    filtered = filtered.filter(n => n.archived)
  } else {
    filtered = filtered.filter(n => !n.archived)
  }

  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  const start = (page - 1) * limit
  const end = start + limit
  const data = filtered.slice(start, end)
  const total = filtered.length
  const hasMore = end < total

  return { data, total, hasMore }
}

/**
 * Mark a notification as read
 */
export async function markAsRead (notificationId: number): Promise<Notification | null> {
  await delay(300)
  const notification = mockNotifications.find(n => n.id === notificationId)
  if (notification) {
    notification.read = true
  }
  return notification || null
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead (): Promise<void> {
  await delay(300)
  for (const n of mockNotifications) {
    if (!n.archived) {
      n.read = true
    }
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification (notificationId: number): Promise<boolean> {
  await delay(300)
  const index = mockNotifications.findIndex(n => n.id === notificationId)
  if (index !== -1) {
    mockNotifications.splice(index, 1)
    return true
  }
  return false
}

/**
 * Delete all notifications
 */
export async function deleteAllNotifications (): Promise<void> {
  await delay(300)
  const archivedIndices: number[] = []
  for (const [i, n] of mockNotifications.entries()) {
    if (!n.archived) {
      archivedIndices.push(i)
    }
  }
  for (let i = archivedIndices.length - 1; i >= 0; --i) {
    mockNotifications.splice(archivedIndices[i], 1)
  }
}

/**
 * Archive a notification
 */
export async function archiveNotification (notificationId: number): Promise<Notification | null> {
  await delay(300)
  const notification = mockNotifications.find(n => n.id === notificationId)
  if (notification) {
    notification.archived = true
  }
  return notification || null
}

/**
 * Restore a notification from archive
 */
export async function restoreNotification (notificationId: number): Promise<Notification | null> {
  await delay(300)
  const notification = mockNotifications.find(n => n.id === notificationId)
  if (notification) {
    notification.archived = false
  }
  return notification || null
}

/**
 * Get a single notification by ID
 */
export async function getNotificationById (notificationId: number): Promise<Notification | null> {
  await delay(200)
  return mockNotifications.find(n => n.id === notificationId) || null
}

/**
 * Search notifications by keyword
 */
export async function searchNotifications (
  keyword: string,
  filter: 'all' | 'unread' | 'archived' = 'all',
): Promise<Notification[]> {
  await delay(300)
  let results = mockNotifications

  if (filter === 'unread') {
    results = results.filter(n => !n.read && !n.archived)
  } else if (filter === 'archived') {
    results = results.filter(n => n.archived)
  } else {
    results = results.filter(n => !n.archived)
  }

  const lowerKeyword = keyword.toLowerCase()
  return results.filter(
    n => n.title.toLowerCase().includes(lowerKeyword) || n.message.toLowerCase().includes(lowerKeyword),
  )
}

/**
 * Get notification statistics
 */
export async function getNotificationStats (): Promise<{
  total: number
  unread: number
  archived: number
  byType: Record<string, number>
}> {
  await delay(200)
  const total = mockNotifications.filter(n => !n.archived).length
  const unread = mockNotifications.filter(n => !n.read && !n.archived).length
  const archived = mockNotifications.filter(n => n.archived).length

  const byType: Record<string, number> = {}
  for (const n of mockNotifications) {
    if (!n.archived) {
      byType[n.type] = (byType[n.type] || 0) + 1
    }
  }

  return { total, unread, archived, byType }
}

/**
 * Clear all archived notifications
 */
export async function clearArchivedNotifications (): Promise<void> {
  await delay(300)
  const archivedIndices: number[] = []
  for (const [i, n] of mockNotifications.entries()) {
    if (n.archived) {
      archivedIndices.push(i)
    }
  }
  for (let i = archivedIndices.length - 1; i >= 0; --i) {
    mockNotifications.splice(archivedIndices[i], 1)
  }
}
