package org.enso.interpreter.test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

import java.util.ArrayList;
import java.util.List;
import java.util.ServiceLoader;
import java.util.stream.Collectors;
import org.enso.logging.service.logback.test.provider.TestLogProvider;
import org.junit.Test;
import org.slf4j.spi.SLF4JServiceProvider;

/**
 * In the `runtime/Test` testing suite, {@link TestLogProvider} should be among the logging
 * providers, because it is explicitly chosen as the logging provider for the tests.
 */
public class TestLogProviderOnClasspath {
  @Test
  public void testLogProviderOnClasspath() {
    var sl = ServiceLoader.load(SLF4JServiceProvider.class);
    var serviceIterator = sl.iterator();
    List<SLF4JServiceProvider> providers = new ArrayList<>();
    while (serviceIterator.hasNext()) {
      providers.add(serviceIterator.next());
    }
    List<String> providerNames =
        providers.stream().map(elem -> elem.getClass().getName()).collect(Collectors.toList());
    assertThat(
        providerNames, hasItem("org.enso.logging.service.logback.test.provider.TestLogProvider"));
  }

  @Test
  public void testLogProviderIsInUnnamedModule() throws Exception {
    var testLogProviderClass =
        Class.forName("org.enso.logging.service.logback.test.provider.TestLogProvider");
    var mod = testLogProviderClass.getModule();
    assertThat(mod, notNullValue());
    assertThat("Should be an unnamed module - with null name", mod.getName(), nullValue());
  }
}
