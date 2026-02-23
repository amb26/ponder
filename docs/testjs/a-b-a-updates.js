assert => {
    //     A
    //   / |
    //  B  | <- Looks like a flag doesn't it? :D
    //   \ |
    //     C
    //     |
    //     D
    const a = fluid.cell(2);

    const b = fluid.cell().computed(
        aVal => aVal - 1, [a]);

    const c = fluid.cell().computed(
        (aVal, bVal) => aVal + bVal, [a, b]);

    let computeCount = 0;

    const d = fluid.cell().computed(
        cVal => {
            computeCount++;
            return "d: " + cVal;
        },
        [c]
    );

    // Trigger read
    assert.equal(d.get(), "d: 3");
    assert.equal(computeCount, 1);
    computeCount = 0;

    a.set(4);
    d.get();
    assert.equal(computeCount, 1);
}
