/**
 * Bitcrusher AudioWorklet processor.
 *
 * Runs in AudioWorkletGlobalScope (separate audio thread, no DOM, no imports).
 * Loaded via ctx.audioWorklet.addModule('/bitcrusher-processor.js').
 *
 * Two parameters:
 *   bits  — quantization depth (1..16)
 *   reduction — sample-and-hold step size (1 = no reduction, 50 = heavy)
 *
 * Both are k-rate — read once per 128-sample render quantum.
 */
class BitcrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 8, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'reduction', defaultValue: 4, minValue: 1, maxValue: 50, automationRate: 'k-rate' },
    ]
  }

  constructor() {
    super()
    this.phase = 0
    this.last = [0, 0]
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0) return true

    const bits = parameters.bits[0]
    const reduction = parameters.reduction[0]
    const step = Math.pow(0.5, bits)

    for (let ch = 0; ch < output.length; ch++) {
      const inCh = input[ch] || input[0]
      const outCh = output[ch]
      let last = this.last[ch] || 0

      for (let i = 0; i < outCh.length; i++) {
        this.phase += 1
        if (this.phase >= reduction) {
          this.phase = 0
          // Sample-and-hold + quantize
          last = step * Math.floor(inCh[i] / step + 0.5)
        }
        outCh[i] = last
      }
      this.last[ch] = last
    }
    return true
  }
}

registerProcessor('bitcrusher', BitcrusherProcessor)
