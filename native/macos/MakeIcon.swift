import AppKit

let size = 1024
let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()
let rect = NSRect(x: 0, y: 0, width: size, height: size)
let background = NSBezierPath(roundedRect: rect.insetBy(dx: 45, dy: 45), xRadius: 220, yRadius: 220)
NSGradient(colors: [NSColor(calibratedRed: 0.58, green: 0.42, blue: 0.98, alpha: 1), NSColor(calibratedRed: 0.32, green: 0.24, blue: 0.75, alpha: 1)])?.draw(in: background, angle: -45)
func sparkle(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) {
    let p = NSBezierPath()
    p.move(to: NSPoint(x: x, y: y + h / 2))
    p.curve(to: NSPoint(x: x + w / 2, y: y), controlPoint1: NSPoint(x: x + w * 0.09, y: y + h * 0.09), controlPoint2: NSPoint(x: x + w * 0.22, y: y + h * 0.02))
    p.curve(to: NSPoint(x: x + w, y: y + h / 2), controlPoint1: NSPoint(x: x + w * 0.78, y: y + h * 0.02), controlPoint2: NSPoint(x: x + w * 0.91, y: y + h * 0.09))
    p.curve(to: NSPoint(x: x + w / 2, y: y + h), controlPoint1: NSPoint(x: x + w * 0.91, y: y + h * 0.91), controlPoint2: NSPoint(x: x + w * 0.78, y: y + h * 0.98))
    p.curve(to: NSPoint(x: x, y: y + h / 2), controlPoint1: NSPoint(x: x + w * 0.22, y: y + h * 0.98), controlPoint2: NSPoint(x: x + w * 0.09, y: y + h * 0.91))
    p.close()
    p.fill()
}
NSColor.white.setFill()
sparkle(295, 300, 420, 420)
sparkle(595, 625, 165, 165)
image.unlockFocus()
let tiff = image.tiffRepresentation!
let bitmap = NSBitmapImageRep(data: tiff)!
let png = bitmap.representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
