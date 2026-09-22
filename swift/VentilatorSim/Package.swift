// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "VentilatorSim",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "VentilatorCore", targets: ["VentilatorCore"])
    ],
    targets: [
        .target(name: "VentilatorCore"),
        .testTarget(name: "VentilatorCoreTests", dependencies: ["VentilatorCore"])
    ],
    // tools-version 6.0 の既定は Swift 6 モードで、そこでは public な static let が
    // Sendable を要求される（LessonLibrary.chapters など）。エンジンもレッスンも
    // 1 つのスレッドからしか触らないので、App 側と同じ Swift 5 モードでそろえる。
    swiftLanguageModes: [.v5]
)
