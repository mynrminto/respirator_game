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
    ]
)
