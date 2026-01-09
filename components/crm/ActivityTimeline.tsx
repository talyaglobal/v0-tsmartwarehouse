"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, Calendar, MapPin, FileText, CheckCircle } from "@/components/icons"
import type { CRMActivity } from "@/types"
import { formatDate } from "@/lib/utils/format"

interface ActivityTimelineProps {
  activities: CRMActivity[]
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-4 w-4" />
      case "email":
        return <Mail className="h-4 w-4" />
      case "visit":
        return <MapPin className="h-4 w-4" />
      case "meeting":
        return <Calendar className="h-4 w-4" />
      case "task":
        return <CheckCircle className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case "call":
        return "bg-blue-100 text-blue-800"
      case "email":
        return "bg-green-100 text-green-800"
      case "visit":
        return "bg-purple-100 text-purple-800"
      case "meeting":
        return "bg-orange-100 text-orange-800"
      case "task":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-4">
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No activities yet</p>
      ) : (
        activities.map((activity) => (
          <Card key={activity.id} className="border-l-4 border-l-primary">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${getActivityColor(activity.activityType)}`}>
                  {getActivityIcon(activity.activityType)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-sm">{activity.subject}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(activity.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline" className={getActivityColor(activity.activityType)}>
                      {activity.activityType}
                    </Badge>
                  </div>
                  {activity.description && (
                    <p className="text-sm text-muted-foreground mt-2">{activity.description}</p>
                  )}
                  {activity.outcome && (
                    <Badge variant="secondary" className="mt-2">
                      {activity.outcome}
                    </Badge>
                  )}
                  {activity.visitPhotos && activity.visitPhotos.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {activity.visitPhotos.slice(0, 3).map((photo, idx) => (
                        <img
                          key={idx}
                          src={photo}
                          alt={`Visit photo ${idx + 1}`}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

