/**
 * Create a WAV file header for PCM audio
 * @param dataLength - Length of PCM data in bytes
 * @param sampleRate - Sample rate (default 16000 Hz)
 * @param numChannels - Number of channels (default 1 for mono)
 * @param bitsPerSample - Bits per sample (default 16)
 * @returns WAV header buffer
 */
export function createWavHeader(
    dataLength: number,
    sampleRate: number = 16000,
    numChannels: number = 1,
    bitsPerSample: number = 16
): Buffer {
    const header = Buffer.alloc(44);

    // RIFF chunk descriptor
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4); // File size - 8
    header.write('WAVE', 8);

    // fmt sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // ByteRate
    header.writeUInt16LE(numChannels * bitsPerSample / 8, 32); // BlockAlign
    header.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);

    return header;
}

/**
 * Create a complete WAV file from raw PCM data
 * @param pcmData - Raw PCM audio data
 * @param sampleRate - Sample rate (default 16000 Hz)
 * @returns Complete WAV file buffer
 */
export function createWavFile(pcmData: Buffer, sampleRate: number = 16000): Buffer {
    const header = createWavHeader(pcmData.length, sampleRate);
    return Buffer.concat([header, pcmData]);
}
