package org.enso.languageserver.websocket.json

import io.circe.literal._
import org.enso.languageserver.search.Suggestions
import org.enso.languageserver.websocket.json.{SearchJsonMessages => json}
import org.enso.polyglot.{ExportedSymbol, ModuleExports}
import org.enso.polyglot.data.Tree
import org.enso.polyglot.runtime.Runtime.Api
import org.enso.testkit.{FlakySpec, ReportLogsOnFailure}

import scala.collection.immutable.ListSet

class SuggestionsHandlerEventsTest
    extends BaseServerTest
    with FlakySpec
    with ReportLogsOnFailure {

  "SuggestionsHandlerEvents" must {

    "send suggestions database notifications" taggedAs Flaky in {
      val client = getInitialisedWsClient()

      client.send(json.acquireSuggestionsDatabaseUpdatesCapability(0))
      client.expectJson(json.ok(0))

      // add type
      system.eventStream.publish(
        Api.SuggestionsDatabaseModuleUpdateNotification(
          "Foo.Main",
          Vector(),
          Vector(),
          Tree.Root(
            Vector(
              Tree.Node(
                Api.SuggestionUpdate(
                  Suggestions.tpe,
                  Api.SuggestionAction.Add()
                ),
                Vector()
              )
            )
          )
        )
      )
      client.expectJson(json"""
        { "jsonrpc" : "2.0",
          "method" : "search/suggestionsDatabaseUpdates",
          "params" : {
            "updates" : [
              {
                "type" : "Add",
                "id" : 1,
                "suggestion" : {
                  "type" : "type",
                  "module" : "local.Test.Main",
                  "name" : "Newtype",
                  "params" : [
                    {
                      "name" : "a",
                      "reprType" : "Any",
                      "isSuspended" : false,
                      "hasDefault" : false,
                      "defaultValue" : null,
                      "tagValues" : null
                    }
                  ],
                  "parentType" : "Any",
                  "reexports" : []
               }
             }
           ],
            "currentVersion" : 1
          }
        }
        """)

      // add constructor
      system.eventStream.publish(
        Api.SuggestionsDatabaseModuleUpdateNotification(
          "Foo.Main",
          Vector(),
          Vector(),
          Tree.Root(
            Vector(
              Tree.Node(
                Api.SuggestionUpdate(
                  Suggestions.constructor,
                  Api.SuggestionAction.Add()
                ),
                Vector()
              )
            )
          )
        )
      )
      client.expectJson(json"""
        { "jsonrpc" : "2.0",
          "method" : "search/suggestionsDatabaseUpdates",
          "params" : {
            "updates" : [
              {
                "type" : "Add",
                "id" : 2,
                "suggestion" : {
                  "type" : "constructor",
                  "module" : "local.Test.Main",
                  "name" : "MyType",
                  "arguments" : [
                    {
                      "name" : "a",
                      "reprType" : "Any",
                      "isSuspended" : false,
                      "hasDefault" : false,
                      "defaultValue" : null,
                      "tagValues" : null
                    }
                  ],
                  "returnType" : "MyAtom",
                  "documentation" : " PRIVATE\n\n A key-value store. This type assumes all keys are pairwise comparable,\n using the `<`, `>` and `==` operators.\n\n Arguments:\n - one: The first.\n - two_three: The *second*.\n\n ? Info\n   Here is a thing.",
                  "annotations" : ["a"],
                  "reexports" : []
               }
             }
           ],
            "currentVersion" : 2
          }
        }
        """)

      // add getter
      system.eventStream.publish(
        Api.SuggestionsDatabaseModuleUpdateNotification(
          "Foo.Main",
          Vector(),
          Vector(),
          Tree.Root(
            Vector(
              Tree.Node(
                Api.SuggestionUpdate(
                  Suggestions.getter,
                  Api.SuggestionAction.Add()
                ),
                Vector()
              )
            )
          )
        )
      )
      client.expectJson(json"""
        { "jsonrpc" : "2.0",
          "method" : "search/suggestionsDatabaseUpdates",
          "params" : {
            "updates" : [
              {
                "type" : "Add",
                "id" : 3,
                "suggestion" : {
                  "type" : "method",
                  "module" : "local.Test.Main",
                  "name" : "a",
                  "arguments" : [ ],
                  "selfType" : "MyType",
                  "returnType" : "Any",
                  "isStatic" : false,
                  "annotations" : [ ],
                  "reexports" : [ ]
                }
              }
            ],
            "currentVersion" : 3
          }
        }
        """)

      // add method
      system.eventStream.publish(
        Api.SuggestionsDatabaseModuleUpdateNotification(
          "Foo.Main",
          Vector(),
          Vector(),
          Tree.Root(
            Vector(
              Tree.Node(
                Api.SuggestionUpdate(
                  Suggestions.constructor,
                  Api.SuggestionAction.Modify()
                ),
                Vector(
                  Tree.Node(
                    Api.SuggestionUpdate(
                      Suggestions.method,
                      Api.SuggestionAction.Add()
                    ),
                    Vector()
                  )
                )
              )
            )
          )
        )
      )
      client.expectJson(json"""
        { "jsonrpc" : "2.0",
          "method" : "search/suggestionsDatabaseUpdates",
          "params" : {
            "updates" : [
              {
                "type" : "Add",
                "id" : 4,
                "suggestion" : {
                  "type" : "method",
                  "externalId" : "ea9d7734-26a7-4f65-9dd9-c648eaf57d63",
                  "module" : "local.Test.Main",
                  "name" : "foo",
                  "arguments" : [
                    {
                      "name" : "this",
                      "reprType" : "MyType",
                      "isSuspended" : false,
                      "hasDefault" : false,
                      "defaultValue" : null,
                      "tagValues" : null
                    },
                    {
                      "name" : "foo",
                      "reprType" : "Number",
                      "isSuspended" : false,
                      "hasDefault" : true,
                      "defaultValue" : "42",
                      "tagValues" : null
                    }
                  ],
                  "selfType" : "MyType",
                  "returnType" : "Number",
                  "isStatic" : false,
                  "documentation" : "Lovely",
                  "annotations" : ["foo"],
                  "reexports" : []
                }
              }
            ],
            "currentVersion" : 4
          }
        }
        """)

      // add function
      system.eventStream.publish(
        Api.SuggestionsDatabaseModuleUpdateNotification(
          "Foo.Main",
          Vector(),
          Vector(),
          Tree.Root(
            Vector(
              Tree.Node(
                Api.SuggestionUpdate(
                  Suggestions.constructor,
                  Api.SuggestionAction.Modify()
                ),
                Vector(
                  Tree.Node(
                    Api.SuggestionUpdate(
                      Suggestions.method,
                      Api.SuggestionAction.Modify()
                    ),
                    Vector(
                      Tree.Node(
                        Api.SuggestionUpdate(
                          Suggestions.function,
                          Api.SuggestionAction.Add()
                        ),
                        Vector()
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
      client.expectJson(json"""
        { "jsonrpc" : "2.0",
          "method" : "search/suggestionsDatabaseUpdates",
          "params" : {
            "updates" : [
              {
                "type" : "Add",
                "id" : 5,
                "suggestion" : {
                  "type" : "function",
                  "externalId" : "78d452ce-ed48-48f1-b4f2-b7f45f8dff89",
                  "module" : "local.Test.Main",
                  "name" : "print",
                  "arguments" : [
                    {
                      "name" : "a",
                      "reprType" : "Any",
                      "isSuspended" : false,
                      "hasDefault" : false,
                      "defaultValue" : null,
                      "tagValues" : null
                    },
                    {
                      "name" : "b",
                      "reprType" : "Any",
                      "isSuspended" : true,
                      "hasDefault" : false,
                      "defaultValue" : null,
                      "tagValues" : null
                    },
                    {
                      "name" : "c",
                      "reprType" : "Any",
                      "isSuspended" : false,
                      "hasDefault" : true,
                      "defaultValue" : "C",
                      "tagValues" : null
                    }
                  ],
                  "returnType" : "IO",
                  "scope" : {
                    "start" : {
                      "line" : 1,
                      "character" : 9
                    },
                    "end" : {
                      "line" : 1,
                      "character" : 22
                    }
                  },
                  "documentation" : "My Function"
                }
              }
            ],
            "currentVersion" : 5
          }
        }
      """)

      // add local
      system.eventStream.publish(
        Api.SuggestionsDatabaseModuleUpdateNotification(
          "Foo.Main",
          Vector(),
          Vector(),
          Tree.Root(
            Vector(
              Tree.Node(
                Api.SuggestionUpdate(
                  Suggestions.constructor,
                  Api.SuggestionAction.Modify()
                ),
                Vector(
                  Tree.Node(
                    Api.SuggestionUpdate(
                      Suggestions.method,
                      Api.SuggestionAction.Modify()
                    ),
                    Vector(
                      Tree.Node(
                        Api.SuggestionUpdate(
                          Suggestions.function,
                          Api.SuggestionAction.Modify()
                        ),
                        Vector(
                          Tree.Node(
                            Api.SuggestionUpdate(
                              Suggestions.local,
                              Api.SuggestionAction.Add()
                            ),
                            Vector()
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
      client.expectJson(json"""
        { "jsonrpc" : "2.0",
          "method" : "search/suggestionsDatabaseUpdates",
          "params" : {
            "updates" : [
              {
                "type" : "Add",
                "id" : 6,
                "suggestion" : {
                  "type" : "local",
                  "externalId" : "dc077227-d9b6-4620-9b51-792c2a69419d",
                  "module" : "local.Test.Main",
                  "name" : "x",
                  "returnType" : "Number",
                  "scope" : {
                    "start" : {
                      "line" : 21,
                      "character" : 0
                    },
                    "end" : {
                      "line" : 89,
                      "character" : 0
                    }
                  }
                }
              }
            ],
            "currentVersion" : 6
          }
        }
        """)

      // update items
      system.eventStream.publish(
        Api.SuggestionsDatabaseModuleUpdateNotification(
          "Foo.Main",
          Vector(),
          Vector(),
          Tree.Root(
            Vector(
              Tree.Node(
                Api.SuggestionUpdate(
                  Suggestions.constructor,
                  Api.SuggestionAction.Modify(
                    arguments = Some(
                      Seq(
                        Api.SuggestionArgumentAction
                          .Modify(0, reprType = Some("A")),
                        Api.SuggestionArgumentAction
                          .Add(1, Suggestions.function.arguments(1))
                      )
                    )
                  )
                ),
                Vector(
                  Tree.Node(
                    Api.SuggestionUpdate(
                      Suggestions.method,
                      Api.SuggestionAction.Modify()
                    ),
                    Vector(
                      Tree.Node(
                        Api.SuggestionUpdate(
                          Suggestions.function,
                          Api.SuggestionAction.Modify(
                            externalId = Some(None)
                          )
                        ),
                        Vector(
                          Tree.Node(
                            Api.SuggestionUpdate(
                              Suggestions.local,
                              Api.SuggestionAction.Modify(
                                scope = Some(Suggestions.function.scope)
                              )
                            ),
                            Vector()
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
      client.expectJson(json"""
        {
          "jsonrpc" : "2.0",
          "method" : "search/suggestionsDatabaseUpdates",
          "params" : {
            "updates" : [
              {
                "type" : "Modify",
                "id" : 2,
                "arguments" : [
                  {
                    "type" : "Modify",
                    "index" : 0,
                    "reprType" : {
                      "tag" : "Set",
                      "value" : "A"
                    }
                  },
                  {
                    "type" : "Add",
                    "index" : 1,
                    "argument" : {
                      "name" : "b",
                      "reprType" : "Any",
                      "isSuspended" : true,
                      "hasDefault" : false,
                      "defaultValue" : null,
                      "tagValues" : null
                    }
                  }
                ]
              },
              {
                "type" : "Modify",
                "id" : 5,
                "externalId" : {
                  "tag" : "Remove",
                  "value" : null
                }
              },
              {
                "type" : "Modify",
                "id" : 6,
                "scope" : {
                  "tag" : "Set",
                  "value" : {
                    "start" : {
                      "line" : 1,
                      "character" : 9
                    },
                    "end" : {
                      "line" : 1,
                      "character" : 22
                    }
                  }
                }
              }
            ],
            "currentVersion" : 8
          }
        }
        """)

      // update exports
      system.eventStream.publish(
        Api.SuggestionsDatabaseModuleUpdateNotification(
          "Foo.Main",
          Vector(),
          Vector(
            Api.ExportsUpdate(
              ModuleExports(
                "Foo.Bar",
                ListSet(
                  ExportedSymbol.Type(
                    Suggestions.tpe.module,
                    Suggestions.tpe.name
                  ),
                  ExportedSymbol.Constructor(
                    Suggestions.constructor.module,
                    Suggestions.constructor.name
                  )
                )
              ),
              Api.ExportsAction.Add()
            )
          ),
          Tree.Root(Vector())
        )
      )
      client.expectJson(json"""
          {
            "jsonrpc" : "2.0",
            "method" : "search/suggestionsDatabaseUpdates",
            "params" : {
              "updates" : [
                {
                  "type" : "Modify",
                  "id" : 1,
                  "reexport" : {
                    "tag" : "Set",
                    "value" : "Foo.Bar"
                  }
                },
                {
                  "type" : "Modify",
                  "id" : 2,
                  "reexport" : {
                    "tag" : "Set",
                    "value" : "Foo.Bar"
                  }
                }
              ],
              "currentVersion" : 8
            }
          }
        """)

      // remove items
      system.eventStream.publish(
        Api.SuggestionsDatabaseModuleUpdateNotification(
          "Foo.Main",
          Vector(
            Api.SuggestionsDatabaseAction.Clean(Suggestions.constructor.module)
          ),
          Vector(),
          Tree.Root(Vector())
        )
      )
      client.expectJson(json"""
        {
          "jsonrpc" : "2.0",
          "method" : "search/suggestionsDatabaseUpdates",
          "params" : {
            "updates" : [
              {
                "type" : "Remove",
                "id" : 1
              },
              {
                "type" : "Remove",
                "id" : 2
              },
              {
                "type" : "Remove",
                "id" : 3
              },
              {
                "type" : "Remove",
                "id" : 4
              },
              {
                "type" : "Remove",
                "id" : 5
              },
              {
                "type" : "Remove",
                "id" : 6
              }
            ],
            "currentVersion" : 8
          }
        }
        """)

    }
  }

}
