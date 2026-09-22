import SwiftUI
import SceneKit
import UIKit
import VentilatorCore

/// 肺の物理モデルを 3D で見る画面。Web 版の `web/lung3d.js` の Swift 版。
///
/// ここで新しい物理は起こさない。エンジンが毎フレーム解いている
/// `Paw + Pmus = V/C + R·V̇` の各項と、肺に入っているガス量・シャントを
/// そのまま形と色にするだけ。数字と絵が食い違わないことが目的。
struct LungSceneView: View {
    var controller: SimulationController

    @State private var stage = LungStage()
    /// 実寸（体重から決まる肺の高さ）を出すか、動きを見やすく誇張するか。
    @State private var trueScale = false

    private var model: LungModel { LungModel(engine: controller.engine) }

    var body: some View {
        VStack(spacing: 0) {
            SceneView(scene: stage.scene,
                      pointOfView: stage.camera,
                      options: [.allowsCameraControl, .rendersContinuously])
                .background(Chrome.screen)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .overlay(alignment: .topLeading) { caption }
                .overlay(alignment: .topTrailing) { scaleToggle }

            readout
            equation
        }
        .background(Chrome.screen)
        .onAppear { stage.apply(model, animated: false) }
        .onChange(of: controller.tickCount) { stage.apply(model, animated: true) }
    }

    // MARK: - 画面の中の文字

    private var caption: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(controller.engine.patient.name)
                .font(Chrome.label(11, weight: .bold))
                .foregroundStyle(Chrome.screenInk)
            Text(subtitle)
                .font(Chrome.label(9.5))
                .foregroundStyle(Chrome.screenDim)
        }
        .padding(8)
    }

    /// 体重と、そこから決まる肺の高さ。型推論が重くならないよう 1 行ずつ組む。
    private var subtitle: String {
        let patient = controller.engine.patient
        let kg = patient.predictedBodyWeight.formatted(.number.precision(.fractionLength(1)))
        let height = Int(model.lungHeightCm.rounded())
        return patient.ageLabel + "　" + kg + " kg　肺の高さ " + String(height) + " cm"
    }

    private var scaleToggle: some View {
        Button { trueScale.toggle(); stage.trueScale = trueScale; stage.apply(model, animated: true) } label: {
            Text(trueScale ? "実寸" : "動き")
                .font(Chrome.label(10, weight: .bold))
                .foregroundStyle(Chrome.screenInk)
                .padding(.horizontal, 9).padding(.vertical, 4)
                .background(Capsule().fill(Chrome.screenTile)
                    .overlay(Capsule().stroke(Chrome.screenTileLine, lineWidth: 1)))
        }
        .buttonStyle(.plain)
        .padding(8)
        .accessibilityLabel(trueScale ? "実寸で表示中" : "動きを強調して表示中")
    }

    // MARK: - 数値

    private var readout: some View {
        let m = model
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 1), count: 3),
                         spacing: 1) {
            cell("ガス量", (m.gasLiters * 1000).formatted(.number.precision(.fractionLength(1))), "mL")
            cell("TLC まで", "\(Int(((1 - m.fill) * 100).rounded()))", "%")
            cell("総 PEEP", m.totalPEEP.formatted(.number.precision(.fractionLength(1))), "cmH₂O")
            cell("コンプライアンス", "×\(m.complianceRatio.formatted(.number.precision(.fractionLength(2))))", "正常比")
            cell("気道抵抗", "×\(m.resistanceRatio.formatted(.number.precision(.fractionLength(1))))", "正常比")
            cell("つぶれた肺胞", "\(Int((m.collapse * 100).rounded()))", "%")
        }
        .background(Chrome.screenTileLine)
    }

    private func cell(_ title: String, _ value: String, _ unit: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).font(Chrome.label(9)).foregroundStyle(Chrome.screenDim)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value).font(Chrome.digits(17, weight: .bold)).foregroundStyle(Chrome.screenInk)
                Text(unit).font(.system(size: 8)).foregroundStyle(Chrome.screenDim)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 8).padding(.vertical, 5)
        .background(Chrome.screenTile)
    }

    /// 運動方程式の内訳。3 つ足すと気道内圧になる、というのを数字で見せる。
    private var equation: some View {
        let m = model
        return HStack(spacing: 8) {
            term("弾性 V/C", m.elastic, Chrome.volume)
            term("抵抗 R·V̇", m.resistive, Chrome.flow)
            term("筋 −Pmus", m.muscular, Chrome.spo)
            Text("＝").font(Chrome.label(11)).foregroundStyle(Chrome.screenDim)
            term("Paw", m.elastic + m.resistive + m.muscular, Chrome.pressure)
        }
        .padding(.horizontal, 8).padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Chrome.screen)
    }

    private func term(_ title: String, _ value: Double, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title).font(Chrome.label(8.5)).foregroundStyle(Chrome.screenDim)
            Text(value.formatted(.number.precision(.fractionLength(1))))
                .font(Chrome.digits(14, weight: .bold)).foregroundStyle(tint)
        }
    }
}

// MARK: - モデル（エンジンの値を形に直すだけ）

/// 3D に出すための値。Web 版の readModel と同じ式。
struct LungModel {
    var weightKg: Double
    var frc: Double
    var tlc: Double
    var gasLiters: Double
    /// FRC で 0、TLC で 1。
    var fill: Double
    var complianceRatio: Double
    var resistanceRatio: Double
    /// 硬さ 0〜1。肺の色に使う。
    var stiffness: Double
    /// つぶれた肺胞の割合（シャントそのもの）。
    var collapse: Double
    var totalPEEP: Double
    var lungHeightCm: Double

    var elastic: Double
    var resistive: Double
    var muscular: Double

    init(engine: VentilatorEngine) {
        let patient = engine.patient
        let kg = max(0.4, patient.predictedBodyWeight)
        weightKg = kg
        frc = 0.030 * kg
        tlc = 0.080 * kg
        gasLiters = frc + engine.volume
        fill = Self.clamp((gasLiters - frc) / max(1e-6, tlc - frc), -0.35, 1.25)

        let referenceC = 0.0009 * kg
        let referenceR = 61 / sqrt(kg)
        let resistance = engine.flow >= 0 ? patient.resistanceInsp : patient.resistanceExp
        complianceRatio = patient.compliance / referenceC
        resistanceRatio = resistance / referenceR
        stiffness = Self.clamp((1 - complianceRatio) / 0.65, 0, 1)
        collapse = Self.clamp(engine.shunt, 0, 0.85)
        totalPEEP = engine.measured.totalPEEP
        lungHeightCm = 18 * pow(kg / 20, 1.0 / 3.0)

        elastic = engine.volume / max(1e-6, patient.compliance)
        resistive = resistance * engine.flow
        muscular = -engine.musclePressure
    }

    static func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double {
        min(max(v, lo), hi)
    }
}

// MARK: - SceneKit の中身

/// 肺・気管支・横隔膜のノードを一度だけ組み立て、あとは大きさと色だけ変える。
final class LungStage {
    let scene = SCNScene()
    let camera = SCNNode()

    private let leftLung = SCNNode()
    private let rightLung = SCNNode()
    private let diaphragm = SCNNode()
    private let lungMaterial = SCNMaterial()

    /// 実寸で出すか、動きを見やすく誇張するか。
    var trueScale = false

    init() {
        scene.background.contents = UIColor(Chrome.screen)

        camera.camera = SCNCamera()
        camera.camera?.fieldOfView = 38
        camera.position = SCNVector3(0, 0.1, 5.4)
        scene.rootNode.addChildNode(camera)

        let key = SCNNode()
        key.light = SCNLight()
        key.light?.type = .omni
        key.light?.intensity = 900
        key.position = SCNVector3(3, 4, 5)
        scene.rootNode.addChildNode(key)

        let ambient = SCNNode()
        ambient.light = SCNLight()
        ambient.light?.type = .ambient
        ambient.light?.intensity = 420
        scene.rootNode.addChildNode(ambient)

        lungMaterial.diffuse.contents = UIColor(red: 0.98, green: 0.62, blue: 0.68, alpha: 1)
        lungMaterial.transparency = 0.92
        lungMaterial.lightingModel = .blinn

        for (node, side) in [(leftLung, Float(-1)), (rightLung, Float(1))] {
            let sphere = SCNSphere(radius: 1)
            sphere.segmentCount = 36
            sphere.materials = [lungMaterial]
            node.geometry = sphere
            // 左肺は心臓のぶん細い。Web 版と同じ比率。
            node.position = SCNVector3(side * 0.86, 0.15, 0)
            scene.rootNode.addChildNode(node)
        }

        // 気管と左右の主気管支
        let trachea = SCNNode()
        let tube = SCNCylinder(radius: 0.12, height: 1.5)
        tube.materials = [pipeMaterial()]
        trachea.geometry = tube
        trachea.position = SCNVector3(0, 1.45, 0)
        scene.rootNode.addChildNode(trachea)

        for side in [Float(-1), Float(1)] {
            let bronchus = SCNNode()
            let pipe = SCNCylinder(radius: 0.08, height: 1.1)
            pipe.materials = [pipeMaterial()]
            bronchus.geometry = pipe
            bronchus.position = SCNVector3(side * 0.42, 0.78, 0)
            bronchus.eulerAngles = SCNVector3(0, 0, side * 0.75)
            scene.rootNode.addChildNode(bronchus)
        }

        // 横隔膜。吸気で下がる。
        let dome = SCNCylinder(radius: 2.1, height: 0.08)
        let domeMaterial = SCNMaterial()
        domeMaterial.diffuse.contents = UIColor(red: 0.62, green: 0.70, blue: 0.95, alpha: 1)
        domeMaterial.transparency = 0.55
        dome.materials = [domeMaterial]
        diaphragm.geometry = dome
        diaphragm.position = SCNVector3(0, -1.6, 0)
        scene.rootNode.addChildNode(diaphragm)
    }

    private func pipeMaterial() -> SCNMaterial {
        let material = SCNMaterial()
        material.diffuse.contents = UIColor(red: 0.85, green: 0.87, blue: 0.95, alpha: 1)
        material.lightingModel = .blinn
        return material
    }

    /// 数値を形と色に反映する。5 Hz で呼ばれるので、間は SceneKit に補間させる。
    func apply(_ model: LungModel, animated: Bool) {
        // 実寸では体重どおりの大きさ、そうでなければ動きが見えるように誇張する。
        let base = trueScale ? CGFloat(model.lungHeightCm / 18) : 1.0
        let swing = trueScale ? 0.16 : 0.34
        let grow = Float(base * CGFloat(1 + swing * model.fill))

        let collapsed = CGFloat(model.collapse)
        let stiff = CGFloat(model.stiffness)
        // つぶれるほど紫に、硬いほどくすませる。
        let color = UIColor(red: 0.98 - 0.30 * collapsed,
                            green: 0.62 - 0.26 * collapsed - 0.10 * stiff,
                            blue: 0.68 - 0.06 * collapsed + 0.14 * stiff,
                            alpha: 1)

        SCNTransaction.begin()
        SCNTransaction.animationDuration = animated ? 0.22 : 0
        leftLung.scale = SCNVector3(grow * 0.80, grow * 1.20, grow * 0.72)
        rightLung.scale = SCNVector3(grow * 0.92, grow * 1.20, grow * 0.76)
        diaphragm.position = SCNVector3(0, Float(-1.6 - 0.45 * model.fill), 0)
        lungMaterial.diffuse.contents = color
        SCNTransaction.commit()
    }
}
