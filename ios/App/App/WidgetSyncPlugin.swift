import Foundation
import Capacitor
import WidgetKit

@objc(WidgetSyncPlugin)
public class WidgetSyncPlugin: CAPPlugin {
    @objc func writeWidgetData(_ call: CAPPluginCall) {
        guard let overallAverage = call.getDouble("overallAverage"),
              let promotionStatus = call.getString("promotionStatus"),
              let failingGradesCount = call.getInt("failingGradesCount") else {
            call.reject("Missing required fields")
            return
        }
        
        guard let defaults = UserDefaults(suiteName: "group.ch.notare.app") else {
            call.reject("Failed to initialize UserDefaults for App Group group.ch.notare.app. Verify capabilities in Xcode.")
            return
        }
        
        defaults.set(overallAverage, forKey: "overallAverage")
        defaults.set(promotionStatus, forKey: "promotionStatus")
        defaults.set(failingGradesCount, forKey: "failingGradesCount")
        defaults.synchronize()
        
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        
        call.resolve()
    }
}
