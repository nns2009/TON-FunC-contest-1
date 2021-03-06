import ed25519

# private: 925ead45b48e2db183bff9ae782230e952495ba95fd3bcf6ca0debb981a18cb801f33ee69d38cba5c759f34570964291ba06ef594092a83f036fb26ee0715a19
# public: 01f33ee69d38cba5c759f34570964291ba06ef594092a83f036fb26ee0715a19
# ^ в комменте вторая пара ключей на всякий

PRIVATE = bytes.fromhex(
    '35a18e5c796bfa7c22b9dbd4cb57ce990da253ea6d40c7c4ef00040685c5eeb2' +
    'd9ac7c0682a097dbe84a53df6a72a11135be337b71445a056406a37cc024cd0a')
PUBLIC = bytes.fromhex('d9ac7c0682a097dbe84a53df6a72a11135be337b71445a056406a37cc024cd0a')

signing_key = ed25519.SigningKey(PRIVATE)

sign = signing_key.sign(bytes.fromhex(hex(98831049219504741011544657337442627844289035555318487676891727858432755918071)[2:]), encoding='hex')

print(sign[0:64])
print(sign[64:])