{
    "calculationVersion": 1,
    "port": 80,

    "mongoUrl": "mongodb://127.0.0.1:27017",
    "mongoCollections": ["Dogs"],
    "mongoUsername": "tcp://127.0.0.1:2001",
    "mongoPassword": "tcp://127.0.0.1:2001",

    "calcRequestBroker": "tcp://127.0.0.1:2001",
    "calcRequestChannel": "tcp://127.0.0.1:2001",

    "storageRequestBroker": "tcp://127.0.0.1:2002",
    "storageRequestChannel": "StoreMeasurement",

    "entityCollection": "Dogs",
    "locationCollection": "Locations",

    "notifyBroker": "tcp://127.0.0.1:2003"
}
